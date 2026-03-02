import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { OTPInput } from '@/components/OTPInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { isAuthenticated, setAccessToken } from '@/utils/auth';
import { useToast } from '@/hooks/use-toast';
import { Train, Clock } from 'lucide-react';
import { api } from '@/utils/api';
import {
  BehaviorTracker,
  getDeviceFingerprint,
  calculateHumanScore,
} from '@/utils/behaviorTracking';

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const trackerRef = useRef<BehaviorTracker | null>(null);

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpChallengeToken, setOtpChallengeToken] = useState('');
  const [otpDestination, setOtpDestination] = useState('');
  const [otpExpiresInSeconds, setOtpExpiresInSeconds] = useState(300);

  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/search', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    trackerRef.current = new BehaviorTracker();
    return () => trackerRef.current?.cleanup();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tracker = trackerRef.current;
      if (!tracker) return;

      const behavior = tracker.getPayload();
      const device = getDeviceFingerprint();
      const humanScore = calculateHumanScore(behavior, device);

      await api(
        'register/',
        'POST',
        {
          username,
          email,
          password,
          honeypot,
          humanScore,
          behavior,
          device,
        },
        false
      );

      toast({
        title: 'Registration Successful',
        description: 'You can now login with your credentials',
      });

      setActiveTab('login');
      setUsername('');
      setEmail('');
      setPassword('');
    } catch (error: any) {
      toast({
        title: 'Registration Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tracker = trackerRef.current;
      if (!tracker) return;

      const behavior = tracker.getPayload();
      const device = getDeviceFingerprint();
      const humanScore = calculateHumanScore(behavior, device);

      const data = await api<{
        challengeToken: string;
        otpDestination: string;
        otpExpiresInSeconds: number;
      }>(
        'login/',
        'POST',
        {
          username,
          password,
          honeypot,
          humanScore,
          behavior,
          device,
        },
        false
      );

      setOtpChallengeToken(data.challengeToken);
      setOtpDestination(data.otpDestination);
      setStep('otp');
      setOtpExpiresInSeconds(data.otpExpiresInSeconds || 300);
      setCountdown(data.otpExpiresInSeconds || 300);

      toast({
        title: 'OTP Sent',
        description: `OTP sent to ${data.otpDestination}`,
      });
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerify = async (otp: string) => {
    setLoading(true);

    try {
      const tracker = trackerRef.current;
      if (!tracker) return;
      if (!otpChallengeToken) {
        throw new Error('Missing OTP challenge. Please login again.');
      }

      const behavior = tracker.getPayload();
      const device = getDeviceFingerprint();
      const humanScore = calculateHumanScore(behavior, device);

      const data = await api<{
        token: string;
        user: { username: string; email: string };
      }>(
        'verify-email-otp/',
        'POST',
        { challengeToken: otpChallengeToken, otp, honeypot, humanScore, behavior, device },
        false
      );

      setAccessToken(data.token, {
        id: data.user.email,
        username: data.user.username,
        email: data.user.email,
      });

      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });

      navigate('/search', { replace: true });
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#dfe8f5] p-4 sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] bg-gradient-to-r from-[#1d75d9] via-[#2180e8] to-[#2e8ff5]" />
      <div className="pointer-events-none absolute -top-10 right-[-120px] h-40 w-80 rounded-3xl border border-white/20 bg-white/10" />
      <div className="pointer-events-none absolute top-20 right-16 h-24 w-60 rounded-2xl border border-white/20 bg-white/10" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-3xl items-center justify-center">
        <div className="w-full max-w-xl">
          <div className="mb-0 flex items-center justify-between rounded-t-2xl bg-[#1e7be0] px-6 py-5 text-white shadow-xl sm:px-8">
            <div className="flex items-center gap-3">
              <Train className="h-8 w-8 text-white" />
              <h1 className="text-2xl font-semibold tracking-wide">Captcha free login</h1>
            </div>
            <p className="text-sm text-white/90">Your bookings</p>
          </div>

          <Card className="rounded-b-2xl rounded-t-none border-0 bg-[#f6f8fc] p-5 shadow-2xl sm:p-6">
            {step === 'credentials' ? (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="mb-6 grid w-full grid-cols-2 rounded-xl bg-[#dfe9f8] p-1">
                  <TabsTrigger
                    value="login"
                    className="rounded-lg text-[#35506a] data-[state=active]:bg-white data-[state=active]:text-[#1272d8]"
                  >
                    Login
                  </TabsTrigger>
                  <TabsTrigger
                    value="register"
                    className="rounded-lg text-[#35506a] data-[state=active]:bg-white data-[state=active]:text-[#1272d8]"
                  >
                    Register
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-0">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <input
                      type="text"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      autoComplete="off"
                      tabIndex={-1}
                      style={{ position: 'absolute', left: '-9999px' }}
                    />

                    <div className="space-y-1.5">
                      <Label className="text-sm text-[#617286]">User ID</Label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="h-12 rounded-xl border-[#d8e2ef] bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm text-[#617286]">Password</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 rounded-xl border-[#d8e2ef] bg-white"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]"
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Continue to OTP'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register" className="mt-0">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <input
                      type="text"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      autoComplete="off"
                      tabIndex={-1}
                      style={{ position: 'absolute', left: '-9999px' }}
                    />

                    <div className="space-y-1.5">
                      <Label className="text-sm text-[#617286]">User ID</Label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="h-12 rounded-xl border-[#d8e2ef] bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm text-[#617286]">Email</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-12 rounded-xl border-[#d8e2ef] bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm text-[#617286]">Password</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 rounded-xl border-[#d8e2ef] bg-white"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="h-12 w-full rounded-full bg-[#ec933a] text-white hover:bg-[#e3872a]"
                    >
                      {loading ? 'Creating...' : 'Register'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dceafb]">
                  <Clock className="h-8 w-8 text-[#1f78de]" />
                </div>
                <div>
                  <p className="text-sm text-[#617286]">OTP expires in</p>
                  <p className="mt-1 text-3xl font-semibold text-[#113454]">{countdown}s</p>
                  <p className="mt-1 text-sm text-[#617286]">Sent to {otpDestination}</p>
                </div>
                <Progress
                  value={
                    otpExpiresInSeconds > 0
                      ? ((otpExpiresInSeconds - countdown) / otpExpiresInSeconds) * 100
                      : 0
                  }
                  className="h-2 bg-[#d8e4f5]"
                />
                <OTPInput onComplete={handleOTPVerify} />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
