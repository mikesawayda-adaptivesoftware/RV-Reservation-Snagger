export const environment = {
  production: true,
  // Use relative URL since frontend and backend are served from the same origin
  apiUrl: '/api',
  firebase: {
    apiKey: 'AIzaSyBj00esIcvVRugNkn9bhwGfYBwa5zjeV3U',
    authDomain: 'rv-reservation-snagger.firebaseapp.com',
    projectId: 'rv-reservation-snagger',
    storageBucket: 'rv-reservation-snagger.firebasestorage.app',
    messagingSenderId: '1065195365741',
    appId: '1:1065195365741:web:fee39e82762b5409712664',
  },
  stripe: {
    publishableKey: 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY',
  },
};
