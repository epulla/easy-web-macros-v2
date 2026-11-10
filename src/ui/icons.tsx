import React from 'react';

const line = (d: string) => () => (
  <svg aria-hidden viewBox="0 0 24 24" className="icon">
    <path d={d} />
  </svg>
);
const solid = (body: React.ReactNode) => () => (
  <svg aria-hidden viewBox="0 0 16 16" className="icon icon-solid">
    {body}
  </svg>
);

export const Play = solid(<path d="M4.5 2.8v10.4c0 .6.6.9 1.1.6l8.2-5.2a.7.7 0 0 0 0-1.2L5.6 2.2c-.5-.3-1.1 0-1.1.6z" />);
export const Pause = solid(
  <>
    <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
    <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
  </>,
);
export const Stop = solid(<rect x="3" y="3" width="10" height="10" rx="2" />);
export const Grip = solid(
  <>
    {[4, 8, 12].map((y) => (
      <React.Fragment key={y}>
        <circle cx="6" cy={y} r="1.2" />
        <circle cx="10" cy={y} r="1.2" />
      </React.Fragment>
    ))}
  </>,
);
export const More = solid(
  <>
    <circle cx="3.5" cy="8" r="1.3" />
    <circle cx="8" cy="8" r="1.3" />
    <circle cx="12.5" cy="8" r="1.3" />
  </>,
);
export const Star = solid(<path d="m8 1.3 2 4.2 4.6.7-3.3 3.2.8 4.6L8 11.8 3.9 14l.8-4.6-3.3-3.2 4.6-.7z" />);
export const Gear = line(
  'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
);
export const Edit = line('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z');
export const Chevron = line('m9 6 6 6-6 6');
export const Back = line('m15 18-6-6 6-6');
export const Check = line('M20 6 9 17l-5-5');
export const Close = line('M18 6 6 18M6 6l12 12');
export const Alert = line('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4M12 16h.01');
export const Retry = line('M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5');
export const Target = line('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 1v4M12 19v4M1 12h4M19 12h4');
export const Skip = line('m5 4 10 8-10 8zM19 5v14');
export const Up = line('M12 19V5M5 12l7-7 7 7');
export const Down = line('M12 5v14M19 12l-7 7-7-7');
export const FileIn = line('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3-3 3 3');
export const Download = line('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3');
export const Trash = line('M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6');
export const Pin = line('M12 17v5M9 10.8V4h6v6.8l3 3.2H6z');
export const Keyboard = line('M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10');
export const Reload = line('M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5');
export const Lock = line('M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V7a4 4 0 0 1 8 0v4');

export const Logo = ({ big = false }: { big?: boolean }) => (
  <span aria-hidden className={`logo ${big ? 'logo-lg' : ''}`}>
    <Play />
  </span>
);

// Shown as typed on this computer; Chrome lets people change it in chrome://extensions/shortcuts.
export const SHORTCUT = /Mac/.test(navigator.userAgent) ? 'Option+Shift+R' : 'Alt+Shift+R';
