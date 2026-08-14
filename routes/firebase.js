const express = require('express');
const router = express.Router();

router.get('/api/firebase-config', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        vapidKey: process.env.FIREBASE_VAPID_KEY
    });
});

router.get(['/sw.js', '/firebase-messaging-sw.js'], (req, res) => {
    res.type('application/javascript');
    res.send(`
        importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
        importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

        firebase.initializeApp({
            apiKey: "${process.env.FIREBASE_API_KEY || ''}",
            authDomain: "${process.env.FIREBASE_AUTH_DOMAIN || ''}",
            projectId: "${process.env.FIREBASE_PROJECT_ID || ''}",
            storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET || ''}",
            messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}",
            appId: "${process.env.FIREBASE_APP_ID || ''}"
        });

        const messaging = firebase.messaging();

        self.addEventListener('notificationclick', function(event) {
            event.notification.close();
            event.waitUntil(
                clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
                    if (clientList.length > 0) {
                        let client = clientList[0];
                        for (let i = 0; i < clientList.length; i++) {
                            if (clientList[i].focused) { client = clientList[i]; }
                        }
                        return client.focus();
                    }
                    return clients.openWindow('/');
                })
            );
        });

        const CACHE_NAME = '4send-cache-v3';
        const urlsToCache = ['/', '/script.js'];
        
        self.addEventListener('install', event => {
            self.skipWaiting();
            event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
        });
        
        self.addEventListener('activate', event => {
            event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))));
        });
        
        self.addEventListener('fetch', event => {
            if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.url.includes('firestore') || event.request.url.includes('google')) return;
            event.respondWith(
                fetch(event.request)
                    .then(response => {
                        const resClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                        return response;
                    })
                    .catch(() => caches.match(event.request))
            );
        });
    `);
});

module.exports = router;
