import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Booking } from '@/types/booking';
import { getAccessToken, getCurrentUser, isAuthenticated, logout } from '@/utils/auth';
import { api, API_BASE_URL } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Ticket, Calendar, MapPin, LogOut, IndianRupee, Download } from 'lucide-react';

const normalizeBooking = (b: any): Booking => ({
  ...b,
  id: b.id ?? b.booking_id ?? b.pnr,
  journeyDate: b.journeyDate ?? b.journey_date,
  totalFare: b.totalFare ?? b.total_fare,
  bookingDate: b.bookingDate ?? b.booking_date,
  transactionId: b.transactionId ?? b.transaction_id ?? '-',
  passengers: Array.isArray(b.passengers) ? b.passengers : [],
  seatDetails: Array.isArray(b.seatDetails ?? b.seat_details) ? (b.seatDetails ?? b.seat_details) : [],
  train: {
    ...b.train,
    trainNumber: b.train?.trainNumber ?? b.train?.train_number ?? '-',
    trainName: b.train?.trainName ?? b.train?.train_name ?? '-',
    source: b.train?.source ?? b.source ?? '-',
    destination: b.train?.destination ?? b.destination ?? '-',
    departureTime: b.train?.departureTime ?? b.train?.departure_time ?? '-',
    arrivalTime: b.train?.arrivalTime ?? b.train?.arrival_time ?? '-',
    availableSeats: b.train?.availableSeats ?? b.train?.available_seats ?? 0,
  },
});

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const user = getCurrentUser();
  const userIdentity = user?.username || user?.email || '';

  const downloadTicket = async (bookingId: string, pnr: string) => {
    if (!userIdentity) return;
    try {
      const base = `${API_BASE_URL}/`;
      const url = `${base}download-ticket/?bookingId=${encodeURIComponent(bookingId)}&email=${encodeURIComponent(userIdentity)}&download=1`;
      const token = getAccessToken();
      const response = await fetch(url, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        let message = 'Unable to download ticket';
        try {
          const data = await response.json();
          message = data?.error || message;
        } catch {
          // Ignore parse failures for non-json bodies.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ticket-${pnr}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err?.message || 'Ticket download failed',
        variant: 'destructive',
      });
    }
  };

  // ================= LOAD BOOKINGS =================
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/auth');
      return;
    }

    const fetchBookings = async () => {
      try {
        const data = await api(
          `bookings/?email=${encodeURIComponent(userIdentity)}`,
          'GET',
          undefined,
          true
        );

        const formattedBookings: Booking[] = (data.bookings || []).map((b: any) => normalizeBooking(b));

        setBookings(formattedBookings);
        setLoadError(null);
      } catch (err) {
        setLoadError('Unable to load profile right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [navigate, userIdentity]);

  // ================= LOGOUT =================
  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#dfe8f5] px-4">
        <div className="rounded-2xl bg-white px-6 py-4 text-[#244761] shadow-lg">Opening profile...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#dfe8f5] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg">
          <h2 className="text-xl font-semibold text-[#113454]">Profile unavailable</h2>
          <p className="mt-2 text-sm text-[#617286]">{loadError}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Button onClick={() => navigate('/search')} className="rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]">
              Back to Search
            </Button>
            <Button variant="outline" onClick={handleLogout} className="rounded-full border-[#d8e2ef] bg-white">
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#dfe8f5] py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate('/search')}
            className="rounded-full text-[#244761] hover:bg-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="rounded-full border-[#d8e2ef] bg-white"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-[#1d75d9] via-[#2180e8] to-[#2e8ff5] p-6 text-white shadow-lg">
            <h1 className="text-3xl font-bold">My Bookings</h1>
            <p className="mt-2 text-white/85">Welcome back, {userIdentity}!</p>
          </div>

          {bookings.length === 0 ? (
            <Card className="rounded-2xl border-0 bg-white p-12 text-center shadow-lg">
              <Ticket className="mx-auto mb-4 h-16 w-16 text-[#8ea2b8]" />
              <h3 className="mb-2 text-xl font-semibold text-[#113454]">No Bookings Yet</h3>
              <p className="mb-6 text-[#617286]">
                Start your journey by booking your first train ticket
              </p>
              <Button
                onClick={() => navigate('/search')}
                className="rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]"
              >
                Search Trains
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <Card
                  key={booking.id}
                  className="cursor-pointer rounded-2xl border-0 bg-white p-6 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl"
                  onClick={() => navigate(`/confirmation/${booking.id}`, { state: { booking } })}
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="rounded-full bg-[#1f78de] px-3 py-1 text-sm font-bold text-white">
                          {booking.train.trainNumber}
                        </div>
                        <h3 className="text-lg font-semibold text-[#113454]">
                          {booking.train.trainName}
                        </h3>
                      </div>

                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div className="flex items-center gap-2 text-[#617286]">
                          <MapPin className="h-4 w-4" />
                          <span>
                            {booking.train.source} to {booking.train.destination}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[#617286]">
                          <Calendar className="h-4 w-4" />
                          <span>{booking.journeyDate}</span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-sm text-[#617286]">PNR: {booking.pnr}</p>
                        <p className="text-sm text-[#617286]">
                          {booking.passengers?.length || 0} Passenger
                          {(booking.passengers?.length || 0) > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-3 md:items-end">
                      <div className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        booking.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {booking.status}
                      </div>

                      <div className="text-left md:text-right">
                        <p className="flex items-center text-2xl font-bold text-[#1f78de]">
                          <IndianRupee className="h-5 w-5" />
                          {booking.totalFare}
                        </p>
                        <p className="text-xs text-[#72859a]">
                          Total Fare
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full border-[#d8e2ef] bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/confirmation/${booking.id}`, { state: { booking } });
                          }}
                        >
                          View Ticket
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await downloadTicket(String(booking.id), booking.pnr);
                          }}
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>

                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

