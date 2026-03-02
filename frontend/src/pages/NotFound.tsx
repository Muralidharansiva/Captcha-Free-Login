import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#dfe8f5] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <h1 className="mb-2 text-5xl font-bold text-[#1f78de]">404</h1>
        <p className="mb-5 text-lg text-[#617286]">Oops! Page not found</p>
        <a
          href="/"
          className="inline-flex rounded-full bg-[#ec933a] px-5 py-2.5 font-medium text-white transition-colors hover:bg-[#e3872a]"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
