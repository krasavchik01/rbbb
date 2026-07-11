import { useAuth } from '@/contexts/AuthContext';
import ProjectCommandCenter from '@/pages/ProjectCommandCenter';

export default function Projects() {
  const { user } = useAuth();
  const scope = user?.role === 'ceo' || user?.role === 'admin' ? 'executive' : 'operations';

  return <ProjectCommandCenter scope={scope} />;
}
