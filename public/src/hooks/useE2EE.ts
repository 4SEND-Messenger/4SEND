import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';
import { api } from '../services/api';
import { e2ee } from '../utils/e2ee';
import { toBase64, getAllSessions, deleteSession } from '../utils/e2ee/storage';
import { ensureOneTimePreKeys } from '../utils/e2ee/prekeys';
import { updateSessionCache } from '../utils/e2ee/messenger';
import { useI18n } from './useI18n';
import type { PreKeyBundle } from '../utils/e2ee/types';

interface E2EEInitData {
  from: string;
}

interface E2EEAcceptData {
  from: string;
  identityKey: string;
  ephemeralKey: string;
  usedKeyId: number;
  ciphertext: string;
}

async function uploadBundle(): Promise<void> {
  try {
    const bundle = await e2ee.uploadBundle();
    const result = await api.post<{ status?: string }>('/api/keys/upload', bundle);
    if (result.status !== 'ok') {
      console.warn('E2EE bundle upload: server returned', result);
    }
  } catch (err) {
    console.warn('E2EE bundle upload failed (server may not have E2EE routes yet):', (err as Error)?.message || err);
  }
}

export function useE2EE() {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<Set<string>>(new Set());
  const initInProgress = useRef<Set<string>>(new Set());
  const uploadedRef = useRef(false);

  useEffect(() => {
    e2ee.init().then(async () => {
      await uploadBundle();
      uploadedRef.current = true;
      const all = await getAllSessions();
      const set = new Set<string>();
      for (const s of all) {
        set.add(s.contactUsername.toLowerCase());
        updateSessionCache(s.contactUsername, true);
      }
      setSessions(set);
      setReady(true);
    });
  }, []);

  const refreshSession = useCallback(async (contact: string) => {
    const has = await e2ee.hasSession(contact);
    const key = contact.toLowerCase();
    setSessions(prev => {
      const next = new Set(prev);
      if (has) next.add(key);
      else next.delete(key);
      return next;
    });
    updateSessionCache(contact, has);
  }, []);

  const initiateE2EE = useCallback(async (contactUsername: string) => {
    if (!ready) throw new Error('E2EE not initialized');
    const contact = contactUsername.toLowerCase();
    if (initInProgress.current.has(contact)) return;
    initInProgress.current.add(contact);

    try {
      const bundle = await api.get<PreKeyBundle>(`/api/keys/${contact}`);
      if (!bundle || !bundle.identityKey) throw new Error(t('Собеседник ещё не загрузил ключи шифрования'));

      const session = await e2ee.createOutboundSession(contact, bundle);
      await refreshSession(contact);

      await ensureOneTimePreKeys();

      const socket = getSocket();
      socket.emit('e2ee_accept', {
        to: contact,
        identityKey: await e2ee.getMyPublicKeyBase64(),
        ephemeralKey: toBase64(session.dhRatchetPublic),
        usedKeyId: bundle.oneTimePreKey ? bundle.oneTimePreKey.keyId : -1,
        ciphertext: 'handshake_ack',
      });
    } catch (err) {
      console.error('E2EE start error:', (err as Error)?.message || err);
    } finally {
      initInProgress.current.delete(contact);
    }
  }, [ready, refreshSession, t]);

  const handleE2EEInit = useCallback(async (data: E2EEInitData) => {
    if (!ready) return;
    const from = data.from.toLowerCase();
    if (initInProgress.current.has(from)) return;
    initInProgress.current.add(from);

    try {
      const hasExisting = await e2ee.hasSession(from);
      if (hasExisting) return;

      const bundle = await api.get<PreKeyBundle>(`/api/keys/${from}`);
      if (!bundle.identityKey) return;

      const session = await e2ee.createOutboundSession(from, bundle);
      await refreshSession(from);

      await ensureOneTimePreKeys();

      const socket = getSocket();
      socket.emit('e2ee_accept', {
        to: from,
        identityKey: await e2ee.getMyPublicKeyBase64(),
        ephemeralKey: toBase64(session.dhRatchetPublic),
        usedKeyId: bundle.oneTimePreKey ? bundle.oneTimePreKey.keyId : -1,
        ciphertext: 'handshake_ack',
      });
    } catch (err) {
      console.error('E2EE init error:', err);
    } finally {
      initInProgress.current.delete(from);
    }
  }, [ready, refreshSession]);

  const handleE2EEAccept = useCallback(async (data: E2EEAcceptData) => {
    if (!ready) return;
    const from = data.from.toLowerCase();

    try {
      const hasExisting = await e2ee.hasSession(from);
      if (hasExisting) return;

      await e2ee.createInboundSession(from, data.identityKey, data.ephemeralKey, data.usedKeyId);
      await refreshSession(from);
    } catch (err) {
      console.error('E2EE accept error:', err);
    }
  }, [ready, refreshSession]);

  useEffect(() => {
    if (!ready) return;
    const socket = getSocket();
    socket.on('e2ee_init', handleE2EEInit);
    socket.on('e2ee_accept', handleE2EEAccept);
    return () => {
      socket.off('e2ee_init', handleE2EEInit);
      socket.off('e2ee_accept', handleE2EEAccept);
    };
  }, [ready, handleE2EEInit, handleE2EEAccept]);

  const hasSession = useCallback((contactUsername: string): boolean => {
    return sessions.has(contactUsername.toLowerCase());
  }, [sessions]);

  const removeSession = useCallback(async (contactUsername: string) => {
    const key = contactUsername.toLowerCase();
    await deleteSession(key);
    setSessions(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    updateSessionCache(contactUsername, false);
  }, []);

  return { initiateE2EE, hasSession, isReady: ready, sessions, removeSession };
}
