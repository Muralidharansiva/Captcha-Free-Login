import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isAuthenticated, getCurrentUser } from '@/utils/auth';
import { api } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CreditCard, IndianRupee, ShieldCheck } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Payment = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [bookingData, setBookingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [gatewayReady, setGatewayReady] = useState(false);
  const userIdentity = getCurrentUser()?.username || getCurrentUser()?.email || '';


  const finalizeBooking = useCallback(
    async (transactionId: string) => {
      await api(
        'create-booking/',
        'POST',
        {
          email: userIdentity,
          trainNumber: bookingData.train.trainNumber,
          passengers: bookingData.passengers,
          journeyDate:
            bookingData?.train?.journeyDate ||
            bookingData?.train?.journey_date ||
            bookingData?.train?.date ||
            bookingData?.journeyDate ||
            bookingData?.journey_date,
          transactionId,
        },
        true
      );

      toast({
        title: 'Booking Confirmed',
        description: 'Your ticket has been booked successfully.',
      });
      navigate('/dashboard');
    },
    [bookingData, userIdentity, navigate, toast]
  );

  const ensureRazorpayLoaded = useCallback(async (): Promise<boolean> => {
    if (window.Razorpay) {
      setGatewayReady(true);
      return true;
    }

    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    ) as HTMLScriptElement | null;

    if (existing) {
      await new Promise<void>((resolve) => {
        if (window.Razorpay) {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => resolve(), { once: true });
      });
      const ok = !!window.Razorpay;
      setGatewayReady(ok);
      return ok;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    const loaded = await new Promise<boolean>((resolve) => {
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

    const ok = loaded && !!window.Razorpay;
    setGatewayReady(ok);
    return ok;
  }, []);

  const loadPendingBooking = useCallback(async () => {
    try {
      if (!userIdentity) {
        navigate('/auth');
        return;
      }

      const data = await api(
        `pending-booking/?email=${encodeURIComponent(userIdentity)}`,
        'GET',
        undefined,
        true
      );

      setBookingData(data);
    } catch (err: any) {
      toast({
        title: 'Booking session not found',
        description: err?.message || 'Please select your train again.',
        variant: 'destructive',
      });
      navigate('/search');
    }
  }, [userIdentity, navigate, toast]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/auth');
      return;
    }

    ensureRazorpayLoaded();
    loadPendingBooking();
  }, [navigate, ensureRazorpayLoaded, loadPendingBooking]);

  const validatePaymentForm = (): boolean => {
    if (cardNumber.length !== 16) {
      toast({
        title: 'Invalid card number',
        description: 'Card number must be 16 digits.',
        variant: 'destructive',
      });
      return false;
    }

    if (!cardName || !expiryDate || !cvv) {
      toast({
        title: 'Missing payment details',
        description: 'Fill all payment fields before continuing.',
        variant: 'destructive',
      });
      return false;
    }

    if (!/^\d{2}\/\d{2}$/.test(expiryDate) && !/^\d{2}\/\d{4}$/.test(expiryDate)) {
      toast({
        title: 'Invalid expiry date',
        description: 'Use MM/YY or MM/YYYY format.',
        variant: 'destructive',
      });
      return false;
    }

    if (cvv.length !== 3) {
      toast({
        title: 'Invalid CVV',
        description: 'CVV must be 3 digits.',
        variant: 'destructive',
      });
      return false;
    }

    if (!bookingData?.totalFare) {
      toast({
        title: 'Invalid booking session',
        description: 'Please retry your booking flow.',
        variant: 'destructive',
      });
      navigate('/booking');
      return false;
    }

    if (!userIdentity) {
      toast({
        title: 'Session expired',
        description: 'Please login again.',
        variant: 'destructive',
      });
      navigate('/auth');
      return false;
    }

    return true;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePaymentForm()) {
      return;
    }

    setLoading(true);

    try {
      const hasGateway = await ensureRazorpayLoaded();

      if (!hasGateway) {
        toast({
          title: 'Gateway unavailable',
          description: 'Using fallback payment mode for this booking.',
        });
        await finalizeBooking(`OFFLINE-${Date.now()}`);
        return;
      }

      const order = await api<{
        key: string;
        amount: number;
        order_id: string;
      }>(
        'create-razorpay-order/',
        'POST',
        { amount: bookingData.totalFare, receipt: `rcpt_${Date.now()}` },
        true
      );

      const options = {
        key: order.key,
        amount: order.amount,
        currency: 'INR',
        name: 'IRCTC RailBook',
        description: 'Train Ticket Booking',
        order_id: order.order_id,
        handler: async (response: any) => {
          try {
            await api(
              'verify-payment/',
              'POST',
              {
                email: userIdentity,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              },
              true
            );

            await finalizeBooking(response.razorpay_payment_id);
          } catch (err: any) {
            if (/razorpay is not configured/i.test(err?.message || '')) {
              await finalizeBooking(`OFFLINE-${Date.now()}`);
              return;
            }

            toast({
              title: 'Payment verification failed',
              description: err?.message || 'Please try again.',
              variant: 'destructive',
            });
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        prefill: {
          name: cardName,
          email: userIdentity,
        },
        theme: { color: '#1e3a8a' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        const reason = response?.error?.description || 'Payment failed';
        toast({
          title: 'Payment failed',
          description: reason,
          variant: 'destructive',
        });
        setLoading(false);
      });
      rzp.open();
    } catch (err: any) {
      if (/razorpay is not configured/i.test(err?.message || '')) {
        try {
          toast({
            title: 'Gateway not configured',
            description: 'Using fallback payment mode for this booking.',
          });
          await finalizeBooking(`OFFLINE-${Date.now()}`);
          return;
        } catch (offlineErr: any) {
          toast({
            title: 'Fallback failed',
            description: offlineErr?.message || 'Fallback payment failed',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Payment failed',
          description: err?.message || 'Payment failed',
          variant: 'destructive',
        });
      }
      setLoading(false);
    }
  };

  if (!bookingData) return null;

  return (
    <div className="min-h-screen bg-[#dfe8f5] p-4 sm:p-8">
      <div className="mx-auto max-w-lg">
        <Button
          variant="ghost"
          onClick={() => navigate('/booking')}
          className="mb-5 rounded-full text-[#244761] hover:bg-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Booking
        </Button>

        <Card className="mb-5 rounded-2xl border-0 bg-gradient-to-r from-[#1d75d9] via-[#2180e8] to-[#2e8ff5] p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/85">Amount to Pay</p>
              <p className="mt-1 flex items-center text-3xl font-bold">
                <IndianRupee className="h-6 w-6" />
                {bookingData.totalFare}
              </p>
            </div>
            <CreditCard className="h-10 w-10 text-white/90" />
          </div>
        </Card>

        <Card className="rounded-2xl border-0 bg-white p-6 shadow-xl">
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[#617286]">Card Number</Label>
              <Input
                value={cardNumber}
                maxLength={16}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 16) setCardNumber(value);
                }}
                placeholder="Enter 16 digit card number"
                className="h-12 rounded-xl border-[#d8e2ef] bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#617286]">Name on Card</Label>
              <Input
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="h-12 rounded-xl border-[#d8e2ef] bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[#617286]">Expiry</Label>
                <Input
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  placeholder="MM/YY"
                  className="h-12 rounded-xl border-[#d8e2ef] bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#617286]">CVV</Label>
                <Input
                  type="password"
                  value={cvv}
                  maxLength={3}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                  className="h-12 rounded-xl border-[#d8e2ef] bg-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-[#eef5ff] p-3 text-sm text-[#51657a]">
              <ShieldCheck className="h-4 w-4" />
              <span>Payments are securely processed via Razorpay</span>
            </div>

            <Button type="submit" disabled={loading} className="h-12 w-full rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]">
              {loading ? 'Processing...' : `Pay Rs ${bookingData.totalFare}`}
            </Button>
            {!gatewayReady && (
              <p className="text-center text-xs text-[#8a4b00]">
                Live gateway loading failed. Fallback mode will be used automatically.
              </p>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Payment;
