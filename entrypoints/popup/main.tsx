import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../assets/tailwind.css';

function Popup() { return <main className="p-4">Easy Web Macros</main>; }

createRoot(document.getElementById('root')!).render(<Popup />);
