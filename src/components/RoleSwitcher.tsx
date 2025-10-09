import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Settings } from "lucide-react";

export function RoleSwitcher() {
  const { user, getRoleInfo: getUserRoleInfo } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const currentRoleInfo = getUserRoleInfo();

  const handleClick = () => {
    navigate("/role-switch");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
    >
      <Users className="w-4 h-4" />
      <span className="text-sm font-medium">{currentRoleInfo?.name}</span>
      <Settings className="w-4 h-4 ml-1" />
    </Button>
  );
}