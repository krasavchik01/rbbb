import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { UserRole, getRoleInfo, getAllRoles, PERMISSIONS } from "@/types/roles";
import { Users, Settings, ArrowLeft, Check } from "lucide-react";

export default function RoleSwitch() {
  const { user, switchRole, getRoleInfo: getUserRoleInfo } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Пользователь не найден</h1>
          <Button onClick={() => navigate("/")}>Вернуться на главную</Button>
        </div>
      </div>
    );
  }

  const currentRoleInfo = getUserRoleInfo();
  const allRoles = getAllRoles();

  const handleRoleChange = (newRole: UserRole) => {
    setSelectedRole(newRole);
  };

  const handleConfirm = () => {
    if (selectedRole) {
      switchRole(selectedRole);
      navigate("/");
    }
  };

  const handleCancel = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Назад</span>
              </Button>
              <div className="flex items-center space-x-3">
                <Users className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-xl font-semibold">Переключение роли</h1>
                  <p className="text-sm text-muted-foreground">
                    Выберите роль для демонстрации системы
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="flex items-center space-x-2">
                <Settings className="w-3 h-3" />
                <span>Текущая: {currentRoleInfo?.name}</span>
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid gap-6">
          {/* Current Role Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Текущая роль
            </h2>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{currentRoleInfo?.name}</h3>
                <p className="text-muted-foreground">{currentRoleInfo?.description}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Разрешения: {currentRoleInfo?.permissions.length} из {Object.keys(PERMISSIONS).length}
                </p>
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-6">Выберите роль</h2>
            <div className="grid gap-4">
              {allRoles.map((role) => {
                const roleInfo = getRoleInfo(role.id);
                const isSelected = selectedRole === role.id;
                const isCurrent = user.role === role.id;
                
                return (
                  <div
                    key={role.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                    onClick={() => handleRoleChange(role.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected 
                            ? "border-primary bg-primary" 
                            : "border-muted-foreground"
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold">{roleInfo.name}</h3>
                            {isCurrent && (
                              <Badge variant="secondary" className="text-xs">
                                Текущая
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {roleInfo.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Разрешения: {roleInfo.permissions.length} из {Object.keys(PERMISSIONS).length}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {roleInfo.permissions.length} разрешений
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <Button variant="outline" onClick={handleCancel}>
              Отмена
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!selectedRole || selectedRole === user.role}
              className="flex items-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Применить роль</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


