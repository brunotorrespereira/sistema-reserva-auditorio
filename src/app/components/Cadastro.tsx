"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebaseConfig";

interface CadastroProps {
  onCadastroSuccess: () => void;
  onVoltarParaLogin: () => void;
}

export default function Cadastro({ onCadastroSuccess, onVoltarParaLogin }: CadastroProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      console.log("Tentando cadastrar:", email);
      await createUserWithEmailAndPassword(auth, email, password);
      console.log("Cadastro realizado com sucesso!");
      onCadastroSuccess();
    } catch (error: any) {
      console.error("Erro no cadastro:", error);
      setError("Erro no cadastro: " + (error.message || "Tente novamente"));
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
            Criar Conta
          </h1>
          <p className="text-gray-300">
            Cadastre-se para usar o sistema
          </p>
        </div>

        <form onSubmit={handleCadastro} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
              placeholder="Mínimo 6 caracteres"
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
            {loading ? "Criando conta..." : "Criar Conta"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onVoltarParaLogin}
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Já tem uma conta? Faça login
          </button>
        </div>
      </div>
    </div>
  );
} 