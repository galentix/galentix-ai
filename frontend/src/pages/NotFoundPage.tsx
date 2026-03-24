import { Link } from 'react-router-dom';
import GalentixLogo from '../components/ui/GalentixLogo';

export default function NotFoundPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-slate-900 px-4">
      <GalentixLogo size="lg" className="mb-8" />
      <h1 className="text-7xl font-bold text-gray-300 dark:text-slate-600">404</h1>
      <p className="mt-3 text-xl text-gray-500 dark:text-gray-400">Page Not Found</p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-galentix-500 hover:bg-galentix-600 text-white font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-galentix-500 focus-visible:ring-offset-2"
      >
        Back to Chat
      </Link>
    </div>
  );
}
