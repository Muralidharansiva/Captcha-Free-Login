import { BehaviorPayload, DeviceFingerprint } from '@/types/booking';

export class BehaviorTracker {
  private keyPresses: number[] = [];
  private mouseMovements: { x: number; y: number; time: number }[] = [];
  private clickCount = 0;
  private focusEvents = 0;
  private blurEvents = 0;
  private startTime: number = Date.now();
  private firstKeyTime: number | null = null;

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    // Track keyboard events
    document.addEventListener('keydown', this.handleKeyPress);
    
    // Track mouse movements
    document.addEventListener('mousemove', this.handleMouseMove);
    
    // Track clicks
    document.addEventListener('click', this.handleClick);
    
    // Track focus/blur
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('blur', this.handleBlur);
  }

  private handleKeyPress = (e: KeyboardEvent) => {
    const now = Date.now();
    if (this.firstKeyTime === null) {
      this.firstKeyTime = now;
    }
    this.keyPresses.push(now);
  };

  private handleMouseMove = (e: MouseEvent) => {
    this.mouseMovements.push({
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    });
    // Keep only last 100 movements to avoid memory issues
    if (this.mouseMovements.length > 100) {
      this.mouseMovements.shift();
    }
  };

  private handleClick = () => {
    this.clickCount++;
  };

  private handleFocus = () => {
    this.focusEvents++;
  };

  private handleBlur = () => {
    this.blurEvents++;
  };

  getPayload(): BehaviorPayload {
    const now = Date.now();
    const duration = now - this.startTime;
    
    // Calculate inter-key intervals
    const interKeyIntervals = [];
    for (let i = 1; i < this.keyPresses.length; i++) {
      interKeyIntervals.push(this.keyPresses[i] - this.keyPresses[i - 1]);
    }
    const avgInterKeyMs = interKeyIntervals.length > 0
      ? interKeyIntervals.reduce((a, b) => a + b, 0) / interKeyIntervals.length
      : 0;

    // Calculate mouse distance
    let totalDistance = 0;
    for (let i = 1; i < this.mouseMovements.length; i++) {
      const dx = this.mouseMovements[i].x - this.mouseMovements[i - 1].x;
      const dy = this.mouseMovements[i].y - this.mouseMovements[i - 1].y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
    }

    return {
      typing: {
        durationMs: duration,
        avgInterKeyMs: Math.round(avgInterKeyMs),
        keyCount: this.keyPresses.length
      },
      mouse: {
        moveEvents: this.mouseMovements.length,
        totalDistancePx: Math.round(totalDistance),
        clickCount: this.clickCount
      },
      timing: {
        timeToFirstKeyMs: this.firstKeyTime ? this.firstKeyTime - this.startTime : 0,
        timeToSubmitMs: duration
      },
      focus: {
        focusCount: this.focusEvents,
        blurCount: this.blurEvents
      }
    };
  }

  cleanup() {
    document.removeEventListener('keydown', this.handleKeyPress);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('blur', this.handleBlur);
  }
}

export const getDeviceFingerprint = (): DeviceFingerprint => {
  return {
    ua: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height
  };
};

export const calculateHumanScore = (
  behavior: BehaviorPayload,
  device: DeviceFingerprint
): number => {
  let score = 0.5; // Start neutral

  // Typing analysis
  if (behavior.typing.keyCount > 0) {
    const avgInterKey = behavior.typing.avgInterKeyMs;
    
    // Human typing is typically 80-400ms between keys
    if (avgInterKey >= 80 && avgInterKey <= 400) {
      score += 0.3;
    } else if (avgInterKey < 50) {
      // Too fast, likely bot
      score -= 0.4;
    } else if (avgInterKey > 1000) {
      // Very slow, possibly suspicious
      score -= 0.2;
    }
    
    // Typing duration check
    if (behavior.typing.durationMs > 1000) {
      score += 0.1; // Humans take time to type
    }
  }

  // Mouse movement analysis
  if (behavior.mouse.moveEvents > 10 && behavior.mouse.totalDistancePx > 100) {
    score += 0.2; // Good human-like mouse activity
  } else if (behavior.mouse.moveEvents === 0 && behavior.typing.keyCount > 5) {
    // Typing without mouse movement is suspicious
    score -= 0.3;
  }

  // Focus/blur analysis
  if (behavior.focus.focusCount > 0 || behavior.focus.blurCount > 0) {
    score += 0.1; // Natural tab switching/window focus
  }

  // Click count
  if (behavior.mouse.clickCount > 0) {
    score += 0.1;
  }

  // Device fingerprint checks
  if (device.screenWidth > 0 && device.screenHeight > 0) {
    score += 0.1; // Valid screen dimensions
  }

  // Clamp score between 0 and 1
  return Math.max(0, Math.min(1, score));
};
