import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Train, Shield, Zap, CheckCircle2 } from 'lucide-react';
import { isAuthenticated } from '@/utils/auth';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/search');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#dfe8f5]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1d75d9] via-[#2180e8] to-[#2e8ff5]">
        <div className="pointer-events-none absolute -top-8 right-[-120px] h-44 w-80 rounded-3xl border border-white/20 bg-white/10" />
        <div className="pointer-events-none absolute top-24 right-12 h-24 w-60 rounded-2xl border border-white/20 bg-white/10" />

        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 flex items-center justify-center gap-3">
              <Train className="h-14 w-14 text-white" />
              <h1 className="text-5xl font-bold text-white sm:text-6xl">KITS RailBook</h1>
            </div>
            <p className="mb-4 text-2xl text-white/90">
              Captcha-Free Train Booking System
            </p>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-white/75">
              Experience seamless ticket booking with OTP-based authentication and behavior-aware security.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                className="rounded-full bg-[#ec933a] px-8 text-white hover:bg-[#e3872a]"
                onClick={() => navigate('/auth')}
              >
                Get Started
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white/40 bg-white/10 px-8 text-white hover:bg-white/20"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div id="features" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-10 text-center text-4xl font-bold text-[#113454]">Why Choose KITS RailBook?</h2>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf3ff]">
              <Shield className="h-7 w-7 text-[#1f78de]" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-[#113454]">Secure and Smart</h3>
            <p className="text-[#617286]">
              Behavior analysis and device signals protect your sessions without CAPTCHA friction.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fff4e8]">
              <Zap className="h-7 w-7 text-[#ec933a]" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-[#113454]">Lightning Fast</h3>
            <p className="text-[#617286]">
              Streamlined login and booking steps get you from search to confirmation quickly.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#e9f9ef]">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-[#113454]">Instant Confirmation</h3>
            <p className="text-[#617286]">
              Get PNR and seat details immediately after successful payment.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="mb-10 text-center text-4xl font-bold text-[#113454]">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4 rounded-xl bg-[#f5f9ff] p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1f78de] font-bold text-white">1</div>
              <div>
                <h3 className="text-lg font-semibold text-[#113454]">Register or Login</h3>
                <p className="text-[#617286]">Sign in securely with no CAPTCHA required.</p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl bg-[#f5f9ff] p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1f78de] font-bold text-white">2</div>
              <div>
                <h3 className="text-lg font-semibold text-[#113454]">Verify with OTP</h3>
                <p className="text-[#617286]">Confirm your session using a one-time password.</p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl bg-[#f5f9ff] p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1f78de] font-bold text-white">3</div>
              <div>
                <h3 className="text-lg font-semibold text-[#113454]">Search and Book</h3>
                <p className="text-[#617286]">Pick your train, add passengers, and proceed to payment.</p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl bg-[#f5f9ff] p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1f78de] font-bold text-white">4</div>
              <div>
                <h3 className="text-lg font-semibold text-[#113454]">Get Your Ticket</h3>
                <p className="text-[#617286]">Receive confirmed booking details instantly.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Button
              size="lg"
              className="rounded-full bg-[#ec933a] px-8 text-white hover:bg-[#e3872a]"
              onClick={() => navigate('/auth')}
            >
              Start Booking Now
            </Button>
          </div>
        </div>
      </div>

      <footer className="bg-[#1b69c3] py-8 text-white">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Train className="h-6 w-6" />
            <span className="text-xl font-bold">KITS RailBook</span>
          </div>
          <p className="text-white/80">Secure, fast, and captcha-free train booking</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
