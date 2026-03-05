import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/utils/api';
import { getAccessToken } from '@/utils/auth';

import { Calendar, Ticket, MapPin, IndianRupee } from 'lucide-react';

type Booking = {
  id: string;
  pnr: string;
  journeyDate: string;
  totalFare: number;
  status: string;
  bookingDate: string;
  passengers: any[];

  train: {
    trainName: string;
    trainNumber: string;
    source: string;
    destination: string;
    date: string;
    departureTime: string;
    arrivalTime: string;
  };
};

const BookingHistory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // ----------------------------------------------------
  // Fetch from backend -> /api/bookings/
  // ----------------------------------------------------
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = getAccessToken();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE_URL}/bookings/`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch bookings');
        }

        setBookings(data.bookings || []);
      } catch {
        toast({
          title: 'Unauthorized',
          description: 'Please login again.',
          variant: 'destructive',
        });
        navigate('/auth');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#dfe8f5] p-8 text-center text-[#617286]">
        Loading your bookings...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#dfe8f5] py-8">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#1d75d9] via-[#2180e8] to-[#2e8ff5] p-6 text-white shadow-lg">
          <h2 className="text-3xl font-bold">Booking History</h2>
          <p className="mt-1 text-white/85">View all your past journeys</p>
        </div>

        {bookings.length === 0 ? (
          <Card className="rounded-2xl border-0 bg-white p-10 text-center shadow-md">
            <Ticket className="mx-auto mb-3 h-10 w-10 text-[#8ea2b8]" />
            <p className="text-[#617286]">No bookings found.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="rounded-2xl border-0 bg-white p-6 shadow-md transition-shadow hover:shadow-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-[#113454]">
                      {booking.train.trainName} ({booking.train.trainNumber})
                    </h3>
                    <p className="mt-1 flex items-center gap-2 text-sm text-[#617286]">
                      <MapPin className="h-4 w-4" />
                      {booking.train.source} to {booking.train.destination}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-sm font-mono text-[#1f78de]">PNR: {booking.pnr}</span>
                </div>

                <div className="mt-3 space-y-1 text-sm text-[#45627c]">
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Journey Date: <strong>{booking.journeyDate}</strong>
                  </p>
                  <p>
                    Status: <strong>{booking.status}</strong>
                  </p>
                  <p>
                    Passengers: {booking.passengers.length}
                  </p>
                  <p className="flex items-center gap-1 text-lg font-bold text-[#1f78de]"><IndianRupee className="h-4 w-4" />{booking.totalFare}</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Button
          className="mt-8 rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]"
          onClick={() => navigate('/search')}
        >
          Book Another Ticket
        </Button>
      </div>
    </div>
  );
};

export default BookingHistory;

