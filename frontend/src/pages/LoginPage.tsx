import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { User, Lock, Languages, Phone } from "lucide-react";
import { useAppDispatch } from "@/store";
import { setCredentials } from "@/store/authSlice";
import { type UserRole, decodeJwt } from "@/lib/jwt";
import { salesApi } from "@/services/salesApi";
import { customerApi } from "@/services/customerApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [loginMode, setLoginMode] = useState<"staff" | "customer">("staff");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data =
        loginMode === "staff"
          ? await salesApi.login(username, password)
          : await customerApi.login(phone, password);
      const decoded = decodeJwt(data.access_token);

      if (!decoded) {
        setError(t("auth.invalidCredentials"));
        setIsLoading(false);
        return;
      }

      dispatch(
        setCredentials({
          token: data.access_token,
          userId: decoded.sub,
          role: decoded.role as UserRole,
          customerId: decoded.customer_id,
        })
      );

      navigate("/");
    } catch {
      setError(t("auth.invalidCredentials"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="gradient-glow relative flex min-h-dvh items-center justify-center px-4">
      {/* Language toggle */}
      <button
        type="button"
        onClick={toggleLanguage}
        className="glass absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Toggle language"
      >
        <Languages className="h-4 w-4" />
      </button>

      {/* Login card */}
      <div className="glass-strong w-full max-w-sm animate-scale-in rounded-2xl p-8">
        {/* Logo + branding */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="gradient-primary flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg glow-sm">
            <span className="text-h1 text-white">أ</span>
          </div>
          <div className="text-center">
            <h1 className="text-display text-gradient-primary">أفق</h1>
            <p className="mt-1 text-body-sm text-muted-foreground">
              {t("app.tagline")}
            </p>
          </div>
        </div>

        {/* Login mode toggle */}
        <div className="mb-6 flex rounded-xl bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => setLoginMode("staff")}
            className={`flex-1 rounded-lg px-3 py-2 text-body-sm font-medium transition-colors ${
              loginMode === "staff"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("portal.staffLogin")}
          </button>
          <button
            type="button"
            onClick={() => setLoginMode("customer")}
            className={`flex-1 rounded-lg px-3 py-2 text-body-sm font-medium transition-colors ${
              loginMode === "customer"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("portal.customerLogin")}
          </button>
        </div>

        {/* Error badge */}
        {error && (
          <div className="mb-4 flex justify-center animate-slide-up">
            <Badge variant="destructive" size="lg">
              {error}
            </Badge>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="animate-slide-up" style={{ animationDelay: "50ms", animationFillMode: "both" }}>
            {loginMode === "staff" ? (
              <Input
                inputSize="lg"
                type="text"
                placeholder={t("auth.username")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                startIcon={<User className="h-4 w-4" />}
                required
                autoComplete="username"
              />
            ) : (
              <Input
                inputSize="lg"
                type="tel"
                placeholder={t("portal.phone")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                startIcon={<Phone className="h-4 w-4" />}
                required
                autoComplete="tel"
              />
            )}
          </div>

          <div className="animate-slide-up" style={{ animationDelay: "120ms", animationFillMode: "both" }}>
            <Input
              inputSize="lg"
              type="password"
              placeholder={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              startIcon={<Lock className="h-4 w-4" />}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="animate-slide-up" style={{ animationDelay: "190ms", animationFillMode: "both" }}>
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full"
              isLoading={isLoading}
            >
              {t("auth.login")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
