import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { RateLimitNotice } from '@/components/auth/RateLimitNotice';

export default function Auth() {
  const navigate = useNavigate();
  const { login, signup } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    if (!email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email không hợp lệ';
    }
    
    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }
    
    if (!isLogin && !name.trim()) {
      newErrors.name = 'Vui lòng nhập tên';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setRateLimitError(null); // Clear previous rate limit error
    
    try {
      if (isLogin) {
        const { error } = await login(email, password);
        if (error) {
          // Check if it's a rate limit error
          if (error.includes('Too many') || error.includes('rate limit') || error.includes('retry after')) {
            setRateLimitError(error);
          } else {
            toast({ title: 'Đăng nhập thất bại', description: error, variant: 'destructive' });
          }
        } else {
          toast({ title: 'Chào mừng trở lại!', description: 'Bạn đã đăng nhập thành công' });
          navigate('/');
        }
      } else {
        const { error } = await signup(email, password, name);
        if (error) {
          toast({ title: 'Đăng ký thất bại', description: error, variant: 'destructive' });
        } else {
          toast({ title: 'Tạo tài khoản thành công!', description: 'Chào mừng bạn đến với GIANO' });
          navigate('/');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    const { error } = await login('demo@example.com', 'demo123');
    if (error) {
      toast({ title: 'Đăng nhập thất bại', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Chào mừng!', description: 'Đã đăng nhập với tài khoản demo' });
      navigate('/');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">GIANO</h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? 'Đăng nhập để tiếp tục' : 'Tạo tài khoản mới'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">
          {/* Rate Limit Notice */}
          {rateLimitError && <RateLimitNotice message={rateLimitError} />}
          
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="name">Tên</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Tên của bạn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn("pl-10", errors.name && "border-destructive")}
                  disabled={isLoading}
                />
              </div>
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn("pl-10", errors.email && "border-destructive")}
                disabled={isLoading}
              />
            </div>
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn("pl-10 pr-10", errors.password && "border-destructive")}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Hoặc</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleDemoLogin}
            disabled={isLoading}
          >
            Dùng thử tài khoản Demo
          </Button>
        </form>

        {/* Toggle */}
        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Chưa có tài khoản?" : 'Đã có tài khoản?'}{' '}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrors({});
            }}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </p>

        {/* Demo credentials */}
        <div className="text-center text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <p className="font-medium mb-1">Tài khoản Demo:</p>
          <p>Email: demo@example.com</p>
          <p>Mật khẩu: demo123</p>
        </div>
      </div>
    </div>
  );
}
