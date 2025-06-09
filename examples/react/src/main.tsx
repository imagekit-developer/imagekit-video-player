import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Optional: import global CSS here
// import 'video.js/dist/video-js.css';

// Does not work correctly with strict mode
// @todo fix this
ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
);