export interface Train {
  id: string;
  trainNumber: string;
  trainName: string;
  source: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  availableSeats: number;
  fare: number;
  date: string;
}

export interface Passenger {
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  berth: 'Lower' | 'Middle' | 'Upper' | 'Side Lower' | 'Side Upper' | 'No Preference';
}

export interface Booking {
  id: string;
  userId: string;
  pnr: string;
  train: Train;
  passengers: Passenger[];
  totalFare: number;
  bookingDate: string;
  journeyDate: string;
  status: 'CONFIRMED' | 'RAC' | 'WL' | 'CANCELLED';
  seatDetails: SeatDetail[];
  transactionId: string;
}

export interface SeatDetail {
  passengerName: string;
  coach: string;
  seatNumber: string;
  berth: string;
  status: 'CONFIRMED' | 'RAC' | 'WL';
}

export interface BehaviorPayload {
  typing: {
    durationMs: number;
    avgInterKeyMs: number;
    keyCount: number;
  };
  mouse: {
    moveEvents: number;
    totalDistancePx: number;
    clickCount: number;
  };
  timing: {
    timeToFirstKeyMs: number;
    timeToSubmitMs: number;
  };
  focus: {
    focusCount: number;
    blurCount: number;
  };
}

export interface DeviceFingerprint {
  ua: string;
  language: string;
  timezone: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
}
