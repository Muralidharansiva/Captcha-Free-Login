import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TicketDisplay } from '@/components/TicketDisplay';
import { Booking } from '@/types/booking';
import { Download, Home } from 'lucide-react';
import { api, API_BASE_URL } from '@/utils/api';
import { getAccessToken, getCurrentUser, isAuthenticated } from '@/utils/auth';

const normalizeBooking = (b: any): Booking => ({
  ...b,
  id: b.id ?? b._id ?? b.booking_id ?? b.pnr,
  journeyDate: b.journeyDate ?? b.journey_date,
  totalFare: b.totalFare ?? b.total_fare,
  bookingDate: b.bookingDate ?? b.booking_date,
  transactionId: b.transactionId ?? b.transaction_id,
  passengers: Array.isArray(b.passengers) ? b.passengers : [],
  seatDetails: Array.isArray(b.seatDetails ?? b.seat_details) ? (b.seatDetails ?? b.seat_details) : [],
  train: {
    ...b.train,
    trainNumber: b.train?.trainNumber ?? b.train?.train_number ?? b.trainNumber ?? b.train_number ?? '-',
    trainName: b.train?.trainName ?? b.train?.train_name ?? b.trainName ?? b.train_name ?? '-',
    departureTime: b.train?.departureTime ?? b.train?.departure_time ?? b.departureTime ?? b.departure_time ?? '-',
    arrivalTime: b.train?.arrivalTime ?? b.train?.arrival_time ?? b.arrivalTime ?? b.arrival_time ?? '-',
    source: b.train?.source ?? b.source ?? '-',
    destination: b.train?.destination ?? b.destination ?? '-',
    platformNumber: b.train?.platformNumber ?? b.train?.platform_number ?? b.platformNumber ?? b.platform_number ?? 'Not assigned',
    availableSeats: b.train?.availableSeats ?? b.train?.available_seats ?? b.availableSeats ?? b.available_seats ?? 0,
  },
});

const Confirmation = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getUserIdentity = () => {
    const user = getCurrentUser();
    return user?.username || user?.email || '';
  };

  const buildTicketEndpoint = (download: boolean) => {
    const base = `${API_BASE_URL}/`;
    const email = encodeURIComponent(getUserIdentity());
    const id = encodeURIComponent(bookingId || '');
    const flag = download ? '1' : '0';
    return `${base}download-ticket/?bookingId=${id}&email=${email}&download=${flag}`;
  };

  // --------------------------------------------------
  // Fetch booking from backend
  // --------------------------------------------------
  useEffect(() => {
    const fetchBooking = async () => {
      try {
        if (!isAuthenticated()) {
          navigate('/auth');
          return;
        }

        const stateBooking = (location.state as any)?.booking;
        if (stateBooking) {
          setBooking(normalizeBooking(stateBooking));
          setError(null);
          setLoading(false);
          return;
        }

        if (!bookingId) {
          setError('Missing booking id.');
          setLoading(false);
          navigate('/search');
          return;
        }

        const email = getUserIdentity();
        if (!email) {
          setError('User session not found.');
          setLoading(false);
          navigate('/auth');
          return;
        }

        const data = await api(`bookings/${bookingId}/?email=${email}`, 'GET', undefined, true);
        if (!data?.booking) {
          setError('Booking not found.');
          setLoading(false);
          navigate('/search');
          return;
        }

        setBooking(normalizeBooking(data.booking));
        setError(null);

      } catch {
        setError('Unable to load ticket right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId, location.state, navigate]);

  const handleDownloadTicket = async () => {
    if (!bookingId) return;
    try {
      const token = getAccessToken();
      const response = await fetch(buildTicketEndpoint(true), {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error('download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-${booking?.pnr || bookingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Unable to download ticket right now.');
    }
  };

  useEffect(() => {
    if (!booking) return;
    if (searchParams.get('download') === '1') {
      handleDownloadTicket();
    }
  }, [booking, searchParams, bookingId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#dfe8f5] px-4">
        <div className="rounded-2xl bg-white px-6 py-4 text-[#244761] shadow-lg">Loading ticket...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#dfe8f5] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg">
          <h2 className="text-xl font-semibold text-[#113454]">Ticket unavailable</h2>
          <p className="mt-2 text-sm text-[#617286]">{error || 'Could not load this ticket.'}</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-5 rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#dfe8f5] py-8">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-[#113454]">Booking Confirmed!</h1>
          <p className="mt-2 text-[#617286]">
            Your ticket has been successfully booked
          </p>
        </div>

        <TicketDisplay booking={booking} />

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            variant="outline"
            onClick={handleDownloadTicket}
            className="rounded-full border-[#d8e2ef] bg-white"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Ticket
          </Button>

          <Button
            onClick={() => navigate('/search')}
            className="rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]"
          >
            <Home className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Confirmation;

