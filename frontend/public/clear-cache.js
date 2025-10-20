// Clear all service workers and caches completely
console.log('🧹 Clearing all service workers and caches...');

// Unregister all service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    console.log('📋 Found', registrations.length, 'service worker registrations');
    for(let registration of registrations) {
      registration.unregister().then(function(success) {
        if (success) {
          console.log('✅ Service worker unregistered successfully');
        } else {
          console.log('❌ Failed to unregister service worker');
        }
      });
    }
  });
}

// Clear all caches
if ('caches' in window) {
  caches.keys().then(function(cacheNames) {
    console.log('📋 Found', cacheNames.length, 'caches:', cacheNames);
    return Promise.all(
      cacheNames.map(function(cacheName) {
        console.log('🗑️ Deleting cache:', cacheName);
        return caches.delete(cacheName);
      })
    );
  }).then(function() {
    console.log('✅ All caches cleared');
  });
}

console.log('🎯 All requests should now go to backend at http://localhost:8000/api/chat');