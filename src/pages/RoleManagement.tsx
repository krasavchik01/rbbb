import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleBasedAccess, RoleAccess } from "@/components/RoleBasedAccess";
import { useAuth } from "@/contexts/AuthContext";
import { PERMISSIONS, UserRole, ROLES, getAllRoles } from "@/types/roles";
import { 
  Shield, 
  Users, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  X,
  Check,
  AlertTriangle
} from "lucide-react";

export default function RoleManagement() {
  const { user, checkPermission } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee');
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const allRoles = getAllRoles();
  const currentRole = ROLES[selectedRole];

  const filteredRoles = allRoles.filter(role => 
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditRole = () => {
    setIsEditing(true);
  };

  const handleSaveRole = () => {
    setIsEditing(false);
    // В реальном приложении здесь был бы API вызов
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleDeleteRole = (roleId: UserRole) => {
    // В реальном приложении здесь был бы API вызов
    console.log('Delete role:', roleId);
  };

  const handleCreateRole = () => {
    // В реальном приложении здесь был бы API вызов
    console.log('Create new role');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <Shield className="w-8 h-8 text-primary" />
            <span>Управление ролями</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Настройка ролей и разрешений пользователей
          </p>
        </div>
        <RoleBasedAccess 
          permission={PERMISSIONS.MANAGE_ROLES}
          userRole={user?.role || 'employee'}
        >
          <Button onClick={handleCreateRole} className="btn-gradient">
            <Plus className="w-4 h-4 mr-2" />
            Создать роль
          </Button>
        </RoleBasedAccess>
      </div>

      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="roles">Роли</TabsTrigger>
          <TabsTrigger value="permissions">Разрешения</TabsTrigger>
          <TabsTrigger value="users">Пользователи</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Список ролей */}
            <div className="lg:col-span-1">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Роли системы</h3>
                  <div className="relative">
                    <Input
                      placeholder="Поиск ролей..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  {filteredRoles.map((role) => (
                    <div
                      key={role.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        selectedRole === role.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-secondary/50"
                      }`}
                      onClick={() => setSelectedRole(role.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${role.color}`} />
                          <div>
                            <p className="font-medium">{role.name}</p>
                            <p className="text-sm text-muted-foreground">{role.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="text-xs">
                            {role.permissions.length} разрешений
                          </Badge>
                          <RoleBasedAccess 
                            permission={PERMISSIONS.MANAGE_ROLES}
                            userRole={user?.role || 'employee'}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRole(role.id);
                                handleEditRole();
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </RoleBasedAccess>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Детали роли */}
            <div className="lg:col-span-2">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full ${currentRole.color}`} />
                    <div>
                      <h2 className="text-xl font-semibold">{currentRole.name}</h2>
                      <p className="text-muted-foreground">{currentRole.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      {currentRole.permissions.length} разрешений
                    </Badge>
                    <RoleBasedAccess 
                      permission={PERMISSIONS.MANAGE_ROLES}
                      userRole={user?.role || 'employee'}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEditRole}
                        disabled={isEditing}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Редактировать
                      </Button>
                    </RoleBasedAccess>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="roleName">Название роли</Label>
                      <Input
                        id="roleName"
                        value={currentRole.name}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="roleDescription">Описание</Label>
                      <Textarea
                        id="roleDescription"
                        value={currentRole.description}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={handleCancelEdit}>
                        <X className="w-4 h-4 mr-2" />
                        Отмена
                      </Button>
                      <Button onClick={handleSaveRole} className="btn-gradient">
                        <Save className="w-4 h-4 mr-2" />
                        Сохранить
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-3">Разрешения роли</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(PERMISSIONS).map(([key, permission]) => {
                          const hasPermission = currentRole.permissions.includes(permission);
                          return (
                            <div
                              key={permission}
                              className={`p-3 rounded-lg border flex items-center space-x-3 ${
                                hasPermission
                                  ? "border-green-200 bg-green-50"
                                  : "border-gray-200 bg-gray-50"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                hasPermission ? "bg-green-500" : "bg-gray-300"
                              }`}>
                                {hasPermission && <Check className="w-2 h-2 text-white" />}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{key}</p>
                                <p className="text-xs text-muted-foreground">{permission}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Все разрешения системы</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(PERMISSIONS).map(([key, permission]) => (
                <div key={permission} className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="font-medium">{key}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{permission}</p>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Пользователи по ролям</h3>
            <div className="space-y-4">
              {allRoles.map((role) => (
                <div key={role.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${role.color}`} />
                      <div>
                        <p className="font-medium">{role.name}</p>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">0 пользователей</Badge>
                      <Button variant="ghost" size="sm">
                        <Users className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}



