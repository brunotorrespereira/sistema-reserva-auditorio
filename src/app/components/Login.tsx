"use client";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebaseConfig";

interface LoginProps {
  onLoginSuccess: () => void;
  onShowCadastro: () => void;
}

export default function Login({ onLoginSuccess, onShowCadastro }: LoginProps) {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      await signInWithEmailAndPassword(auth, loginData.email, loginData.password);
      onLoginSuccess();
    } catch (error: any) {
      console.error("Erro no login:", error);
      setError("Erro no login. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
            <img
              src="/logo_ece.jpeg"
              alt="Logo ECE"
              className="w-16 h-16 object-cover rounded-full"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Sistema de Reserva
          </h1>
          <p className="text-gray-300">
            Faça login para continuar
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={loginData.email}
              onChange={(e) => setLoginData({...loginData, email: e.target.value})}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Senha
            </label>
            <input
              type="password"
              value={loginData.password}
              onChange={(e) => setLoginData({...loginData, password: e.target.value})}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
              placeholder="Sua senha"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-cyan-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-4">
          <div className="text-sm text-gray-400">
            <p>Usuários de teste:</p>
            <p className="mt-2">
              <strong>Admin:</strong> admin@ece.com / admin123<br/>
              <strong>Usuário:</strong> user@ece.com / user123
            </p>
          </div>
          
          <div className="border-t border-white/20 pt-4">
            <button
              onClick={onShowCadastro}
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Não tem uma conta? Cadastre-se
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 