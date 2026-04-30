let lockCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';
let originalHtmlOverflow = '';

function shouldAllowScroll(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('[data-allow-scroll="true"]');
}

function handleTouchMove(e: TouchEvent) {
  if (shouldAllowScroll(e.target)) return;
  e.preventDefault();
}

function handleWheel(e: WheelEvent) {
  if (shouldAllowScroll(e.target)) return;
  e.preventDefault();
}

/**
 * Robust scroll lock utility that handles nested modals correctly.
 */
export const ScrollLockManager = {
  lock: () => {
    lockCount++;
    
    if (lockCount === 1) {
      // Check if scrollbar is visible to prevent layout shift
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      originalOverflow = document.body.style.overflow;
      originalPaddingRight = document.body.style.paddingRight;
      originalHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }

      window.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
  },

  unlock: () => {
    if (lockCount === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[ScrollLockManager] unlock() called but no lock is active.');
      }
      return;
    }

    lockCount--;
    
    if (lockCount === 0) {
      document.body.style.overflow = originalOverflow || '';
      document.body.style.paddingRight = originalPaddingRight || '';
      document.documentElement.style.overflow = originalHtmlOverflow || '';
      
      // Cleanup tracking variables
      originalOverflow = '';
      originalPaddingRight = '';
      originalHtmlOverflow = '';

      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchmove', handleTouchMove);
    }
  },

  getCount: () => lockCount
};

// Also export as individual functions for compatibility with previous edits
export function lockScroll() { ScrollLockManager.lock(); }
export function unlockScroll() { ScrollLockManager.unlock(); }
