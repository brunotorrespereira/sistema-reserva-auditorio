"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../firebaseConfig";
import { collection, getDocs, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, deleteDoc, doc } from "firebase/firestore";

interface Reserva {
  id: string;
  data: string;
  horario: string;
  auditorio: string;
  solicitante: string;
  evento: string;
  status: "Reservado";
  observacoes: string;
  createdAt: Date;
}

// Interface para Toast notifications
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export default function ReservaAuditorio() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [formData, setFormData] = useState({
    data: "",
    horario: "",
    auditorio: "",
    solicitante: "",
    evento: "",
    observacoes: "",
  });

  // Estados para filtros
  const [filtroData, setFiltroData] = useState("");
  const [filtroAuditorio, setFiltroAuditorio] = useState("");
  const [filtroSolicitante, setFiltroSolicitante] = useState("");

  // Estados para edição
  const [editando, setEditando] = useState(false);
  const [reservaEditando, setReservaEditando] = useState<Reserva | null>(null);

  // Estados para melhorias de UX
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Carregar dados do Firestore na montagem
  useEffect(() => {
    const q = query(collection(db, "reservas"), orderBy("data", "asc"));
    // Escuta em tempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reservasFirestore = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          data: data.data || "",
          horario: data.horario || "",
          auditorio: data.auditorio || "",
          solicitante: data.solicitante || "",
          evento: data.evento || "",
          status: data.status || "Reservado",
          observacoes: data.observacoes || "",
          createdAt: data.createdAt ? new Date(data.createdAt.seconds ? data.createdAt.seconds * 1000 : data.createdAt) : new Date(),
        } as Reserva;
      });
      setReservas(reservasFirestore);
    });
    return () => unsubscribe();
  }, []);

  // Salvar no localStorage sempre que reservas mudar
  useEffect(() => {
    localStorage.setItem("reservas", JSON.stringify(reservas));
  }, [reservas]);

  // Funções para Toast notifications
  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const newToast: Toast = {
      id: Date.now(),
      message,
      type
    };
    setToasts(prev => [...prev, newToast]);
    
    // Auto-remover toast após 4 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== newToast.id));
    }, 4000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Para input de data, usar diretamente o valor (já está no formato YYYY-MM-DD)
    if (name === 'data') {
      console.log('📝 Form data - Data selecionada:', value);
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Função auxiliar para converter horário (ex: '09h', '09h-12h', '09:30-12:00', '10h30-12h', '10h', '10:30') em minutos desde 00:00
  function horarioParaMinutos(horario: string): [number, number] {
    // Aceita formatos: '09h', '09h-12h', '09:30-12:00', '10h30-12h', '10h', '10:30'
    const normalizar = (h: string) => {
      let [hora, min] = h.replace('h', ':').split(':');
      return parseInt(hora) * 60 + (min ? parseInt(min) : 0);
    };
    if (horario.includes('-')) {
      const [inicio, fim] = horario.split('-').map(s => s.trim());
      return [normalizar(inicio), normalizar(fim)];
    } else {
      const inicio = normalizar(horario.trim());
      // Considera 1h de duração se não for intervalo
      return [inicio, inicio + 60];
    }
  }

  // Função para verificar duplicidade (agora impede sobreposição de horários)
  const verificarDuplicidade = (data: string, horario: string, auditorio: string, idExcluir?: string): boolean => {
    const dataNormalizada = normalizarData(data);
    const [novoInicio, novoFim] = horarioParaMinutos(horario);
    return reservas.some(reserva => {
      if (reserva.id === idExcluir) return false;
      if (normalizarData(reserva.data) !== dataNormalizada) return false;
      if (reserva.auditorio !== auditorio) return false;
      const [resInicio, resFim] = horarioParaMinutos(reserva.horario);
      // Sobreposição: (A começa antes de B terminar) && (A termina depois de B começar)
      return novoInicio < resFim && novoFim > resInicio;
    });
  };

  const addReserva = async () => {
    setLoading(true);
    // Validação dos campos obrigatórios
    if (!formData.data || !formData.horario || !formData.auditorio || !formData.solicitante || !formData.evento) {
      showToast("Por favor, preencha todos os campos obrigatórios!", "error");
      setFormData({
        data: "",
        horario: "",
        auditorio: "",
        solicitante: "",
        evento: "",
        observacoes: "",
      });
      setLoading(false);
      return;
    }
    // Validação de data passada
    const hoje = new Date();
    const dataReserva = new Date(formData.data);
    hoje.setHours(0, 0, 0, 0);
    dataReserva.setHours(0, 0, 0, 0);
    if (dataReserva < hoje) {
      showToast("Não é possível fazer reservas para datas passadas!", "error");
      setLoading(false);
      return;
    }
    // Normalizar a data antes de salvar
    const dataNormalizada = normalizarData(formData.data);
    // Validação de duplicidade com data normalizada
    const temDuplicidade = verificarDuplicidade(dataNormalizada, formData.horario, formData.auditorio, reservaEditando?.id);
    if (temDuplicidade) {
      showToast("Já existe uma reserva para este auditório neste horário e data. Por favor, escolha outro horário ou data.", "warning");
      setFormData({
        data: "",
        horario: "",
        auditorio: "",
        solicitante: "",
        evento: "",
        observacoes: "",
      });
      setLoading(false);
      return;
    }
    if (editando && reservaEditando) {
      // Atualizar reserva existente no Firestore
      try {
        const reservaRef = doc(db, "reservas", reservaEditando.id);
        await updateDoc(reservaRef, {
          data: dataNormalizada,
          horario: formData.horario,
          auditorio: formData.auditorio,
          solicitante: formData.solicitante,
          evento: formData.evento,
          status: "Reservado",
          observacoes: formData.observacoes,
        });
        showToast("Reserva atualizada com sucesso!", "success");
        setEditando(false);
        setReservaEditando(null);
      } catch (error) {
        showToast("Erro ao atualizar reserva!", "error");
      }
      setLoading(false);
      // Limpar formulário
      setFormData({
        data: "",
        horario: "",
        auditorio: "",
        solicitante: "",
        evento: "",
        observacoes: "",
      });
      return;
    } else {
      // Criar nova reserva no Firestore
      try {
        await addDoc(collection(db, "reservas"), {
          data: dataNormalizada,
          horario: formData.horario,
          auditorio: formData.auditorio,
          solicitante: formData.solicitante,
          evento: formData.evento,
          status: "Reservado",
          observacoes: formData.observacoes,
          createdAt: serverTimestamp(),
        });
        showToast("Reserva criada com sucesso!", "success");
      } catch (error) {
        showToast("Erro ao criar reserva!", "error");
      }
    }
    // Limpar formulário
    setFormData({
      data: "",
      horario: "",
      auditorio: "",
      solicitante: "",
      evento: "",
      observacoes: "",
    });
    setLoading(false);
  };

  const editarReserva = (reserva: Reserva) => {
    setEditando(true);
    setReservaEditando(reserva);
    setFormData({
      data: reserva.data,
      horario: reserva.horario,
      auditorio: reserva.auditorio,
      solicitante: reserva.solicitante,
      evento: reserva.evento,
      observacoes: reserva.observacoes,
    });
    
    // Scroll para o formulário
    setTimeout(() => {
      const formSection = document.querySelector('[data-form-section]');
      if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const cancelarEdicao = () => {
    setEditando(false);
    setReservaEditando(null);
    setFormData({
      data: "",
      horario: "",
      auditorio: "",
      solicitante: "",
      evento: "",
      observacoes: "",
    });
  };

  const deleteReserva = async (id: string) => {
    try {
      await deleteDoc(doc(db, "reservas", id));
      showToast("Reserva excluída com sucesso!", "success");
    } catch (error) {
      showToast("Erro ao excluir reserva!", "error");
    }
  };

  const confirmarDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const cancelarDelete = () => {
    setShowDeleteConfirm(null);
  };

  const getStatusColor = () => {
    return "bg-blue-500/20 border-blue-400/30 text-blue-400";
  };

  const getStatusText = () => {
    return "📅 Reservado";
  };

  // Função para normalizar data (sem usar new Date() para evitar problemas de timezone)
  const normalizarData = (dataString: string) => {
    if (!dataString) return '';
    
    console.log('🔍 Normalizando data:', dataString);
    
    // Se já está no formato YYYY-MM-DD, retorna como está
    if (dataString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log('✅ Data já no formato correto:', dataString);
      return dataString;
    }
    
    // Se for uma data ISO, extrair apenas a parte da data
    if (dataString.includes('T') || dataString.includes('Z')) {
      const dataPart = dataString.split('T')[0];
      console.log('🔄 Data ISO extraída:', dataString, '→', dataPart);
      return dataPart;
    }
    
    // Para outros formatos, tentar extrair ano-mes-dia
    const [ano, mes, dia] = dataString.split('-');
    const resultado = `${ano}-${mes}-${dia}`;
    console.log('📅 Data normalizada:', dataString, '→', resultado);
    return resultado;
  };

  // Filtrar reservas baseado nos filtros ativos
  const reservasFiltradas = reservas.filter(reserva => {
    console.log('🔍 Filtrando reserva:', reserva.id, 'Data original:', reserva.data);
    
    // Normalizar datas para comparação
    const dataReservaNormalizada = normalizarData(reserva.data);
    const dataFiltroNormalizada = normalizarData(filtroData);
    
    const matchData = !filtroData || dataReservaNormalizada === dataFiltroNormalizada;
    const matchAuditorio = !filtroAuditorio || reserva.auditorio === filtroAuditorio;
    const matchSolicitante = !filtroSolicitante || 
      reserva.solicitante.toLowerCase().includes(filtroSolicitante.toLowerCase());
    
    // Debug individual para cada reserva
    if (filtroData || filtroAuditorio || filtroSolicitante) {
      console.log(`📊 Comparação: reserva "${reserva.data}" → "${dataReservaNormalizada}" vs filtro "${filtroData}" → "${dataFiltroNormalizada}" = ${dataReservaNormalizada === dataFiltroNormalizada}`);
      console.log(`🎯 Match data: ${matchData}, Match auditório: ${matchAuditorio}, Match solicitante: ${matchSolicitante}`);
    }
    
    return matchData && matchAuditorio && matchSolicitante;
  });

  // Debug: verificar se há reservas e filtros
  console.log('=== DEBUG COMPLETO ===');
  console.log('📊 Reservas totais:', reservas.length);
  console.log('🔍 Filtro data:', filtroData);
  console.log('🔍 Filtro auditório:', filtroAuditorio);
  console.log('🔍 Filtro solicitante:', filtroSolicitante);
  console.log('✅ Reservas filtradas:', reservasFiltradas.length);
  console.log('📋 Todas as reservas:', reservas.map(r => ({ 
    id: r.id, 
    data: r.data, 
    dataFormatada: new Date(r.data).toLocaleDateString('pt-BR'),
    auditorio: r.auditorio,
    solicitante: r.solicitante
  })));
  console.log('🎯 Reservas que passaram no filtro:', reservasFiltradas.map(r => ({ 
    id: r.id, 
    data: r.data, 
    dataFormatada: new Date(r.data).toLocaleDateString('pt-BR'),
    auditorio: r.auditorio,
    solicitante: r.solicitante
  })));
  console.log('=== FIM DEBUG ===');

  const totalReservas = reservas.length;
  const reservadas = reservas.length;

  // Função para formatar data para exibição (sem usar new Date())
  const formatarDataParaExibicao = (dataString: string) => {
    if (!dataString) return '';
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Função para exportar reservas em PDF
  const exportarPDF = () => {
    if (reservasFiltradas.length === 0) {
      showToast("Não há reservas para exportar!", "warning");
      return;
    }

    // Criar novo documento PDF
    const doc = new jsPDF();
    
    // Configurar título
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text("Relatório de Reservas de Auditório", 20, 20);
    
    // Informações do relatório
    doc.setFontSize(12);
    doc.setTextColor(52, 73, 94);
    doc.text(`Data de geração: ${new Date().toLocaleDateString('pt-BR')}`, 20, 35);
    doc.text(`Total de reservas: ${reservasFiltradas.length}`, 20, 45);
    
    // Adicionar filtros aplicados se houver
    let yPosition = 55;
    if (filtroData || filtroAuditorio || filtroSolicitante) {
      doc.text("Filtros aplicados:", 20, yPosition);
      yPosition += 10;
      
      if (filtroData) {
        doc.text(`• Data: ${formatarDataParaExibicao(filtroData)}`, 25, yPosition);
        yPosition += 7;
      }
      if (filtroAuditorio) {
        doc.text(`• Sala: ${filtroAuditorio}`, 25, yPosition);
        yPosition += 7;
      }
      if (filtroSolicitante) {
        doc.text(`• Solicitante: ${filtroSolicitante}`, 25, yPosition);
        yPosition += 7;
      }
      yPosition += 10;
    }
    
    // Preparar dados para a tabela
    const tableData = reservasFiltradas.map(reserva => [
      formatarDataParaExibicao(reserva.data),
      reserva.horario,
      reserva.auditorio,
      reserva.solicitante,
      reserva.evento,
      reserva.status,
      reserva.observacoes || "-"
    ]);
    
    // Criar tabela
    autoTable(doc, {
      head: [['Data', 'Horário', 'Sala', 'Solicitante', 'Evento', 'Status', 'Observações']],
      body: tableData,
      startY: yPosition,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [52, 73, 94],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { top: 10 },
    });
    
    // Gerar nome do arquivo com data e hora
    const dataAtual = new Date();
    const dataFormatada = dataAtual.toISOString().slice(0, 10);
    const horaFormatada = dataAtual.toTimeString().slice(0, 8).replace(/:/g, '-');
    const nomeArquivo = `reservas_auditorio_${dataFormatada}_${horaFormatada}.pdf`;
    
    // Salvar PDF
    doc.save(nomeArquivo);
    
    showToast(`PDF exportado com sucesso! (${reservasFiltradas.length} reservas)`, "success");
  };

  // Log de renderização
  console.log('🎨 Renderizando tabela - Reservas filtradas:', reservasFiltradas.length, 'Filtros:', { data: filtroData, auditorio: filtroAuditorio });



  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-6 py-4 rounded-xl shadow-lg backdrop-blur-lg border transition-all duration-300 transform ${
              toast.type === 'success' 
                ? 'bg-green-500/20 border-green-400/30 text-green-300' 
                : toast.type === 'error'
                ? 'bg-red-500/20 border-red-400/30 text-red-300'
                : toast.type === 'warning'
                ? 'bg-yellow-500/20 border-yellow-400/30 text-yellow-300'
                : 'bg-blue-500/20 border-blue-400/30 text-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-4 text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob"></div>
        <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 mb-6">
              <img 
                src="/logo_ece.jpeg" 
                alt="Logo ECE" 
                className="w-20 h-20 object-cover"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Sistema de Reserva de Auditório
            </h1>
            <p className="text-gray-300 text-lg md:text-xl">
              Gerencie suas reservas de auditório de forma simples e eficiente
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center border border-white/20 shadow-lg">
              <div className="text-3xl font-bold text-white">{totalReservas}</div>
              <div className="text-gray-300 text-sm">Total de Reservas</div>
            </div>
            <div className="bg-blue-500/20 backdrop-blur-lg rounded-2xl p-6 text-center border border-blue-400/30 shadow-lg">
              <div className="text-3xl font-bold text-blue-400">{reservadas}</div>
              <div className="text-blue-300 text-sm">Reservadas</div>
            </div>
            <div className="bg-purple-500/20 backdrop-blur-lg rounded-2xl p-6 text-center border border-purple-400/30 shadow-lg">
              <div className="text-3xl font-bold text-purple-400">{totalReservas}</div>
              <div className="text-purple-300 text-sm">Total Geral</div>
            </div>
          </div>

          {/* Form Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/20 shadow-lg" data-form-section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editando ? 'Editar Reserva' : 'Nova Reserva'}
              </h2>
              {editando && (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs">
                    Editando reserva #{reservaEditando?.id}
                  </span>
                  <button
                    onClick={cancelarEdicao}
                    className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs hover:bg-red-500/40 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Data *</label>
                <input
                  type="date"
                  name="data"
                  value={formData.data}
                  onChange={handleInputChange}
                  placeholder="Selecione uma data"
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-lg rounded-xl border border-white/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Horário *</label>
                <input
                  type="text"
                  name="horario"
                  value={formData.horario}
                  onChange={handleInputChange}
                  placeholder="Ex: 09h-12h"
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-lg rounded-xl border border-white/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Sala *</label>
                <select
                  name="auditorio"
                  value={formData.auditorio}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-lg rounded-xl border border-white/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-300"
                >
                  <option value="" disabled hidden selected>Selecione uma sala</option>
                  <option value="Laboratório de Informática" style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                    Laboratório de Informática
                  </option>
                  <option value="Auditório" style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                    Auditório
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Solicitante *</label>
                <input
                  type="text"
                  name="solicitante"
                  value={formData.solicitante}
                  onChange={handleInputChange}
                  placeholder="Nome do solicitante"
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-lg rounded-xl border border-white/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Evento *</label>
                <input
                  type="text"
                  name="evento"
                  value={formData.evento}
                  onChange={handleInputChange}
                  placeholder="Nome do evento"
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-lg rounded-xl border border-white/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-300"
                />
              </div>

            </div>
            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-medium mb-2">Observações</label>
              <input
                type="text"
                name="observacoes"
                value={formData.observacoes}
                onChange={handleInputChange}
                placeholder="Observações adicionais"
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-lg rounded-xl border border-white/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-300"
              />
            </div>
            <button
              onClick={addReserva}
              disabled={loading}
              className={`px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-semibold hover:from-cyan-600 hover:to-purple-600 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              )}
              {loading ? 'Processando...' : (editando ? 'Atualizar Reserva' : 'Adicionar Reserva')}
            </button>
          </div>

          {/* Filtros Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/20 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Filtros</h2>
              <button
                onClick={exportarPDF}
                disabled={reservasFiltradas.length === 0}
                className={`px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2 ${
                  reservasFiltradas.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar PDF
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Filtrar por Data</label>
                <input
                  type="date"
                  value={filtroData}
                  onChange={(e) => {
                    console.log('📅 Filtro de data alterado:', e.target.value);
                    setFiltroData(e.target.value);
                  }}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-lg rounded-xl border border-white/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Filtrar por Sala</label>
                <select
                  value={filtroAuditorio}
                  onChange={(e) => setFiltroAuditorio(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-lg rounded-xl border border-white/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-300"
                >
                  <option value="" disabled hidden selected>Todas as salas</option>
                  <option value="Laboratório de Informática" style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                    Laboratório de Informática
                  </option>
                  <option value="Auditório" style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                    Auditório
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Buscar por Solicitante</label>
                <input
                  type="text"
                  value={filtroSolicitante}
                  onChange={(e) => {
                    console.log('🔍 Filtro de solicitante alterado:', e.target.value);
                    setFiltroSolicitante(e.target.value);
                  }}
                  placeholder="Digite o nome do solicitante"
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-lg rounded-xl border border-white/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all duration-300"
                />
              </div>
            </div>
            {(filtroData || filtroAuditorio || filtroSolicitante) && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-gray-300 text-sm">Filtros ativos:</span>
                {filtroData && (
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-xs">
                    Data: {formatarDataParaExibicao(filtroData)}
                  </span>
                )}
                {filtroAuditorio && (
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                    Sala: {filtroAuditorio}
                  </span>
                )}
                {filtroSolicitante && (
                  <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">
                    Solicitante: {filtroSolicitante}
                  </span>
                )}
                <button
                  onClick={() => {
                    setFiltroData("");
                    setFiltroAuditorio("");
                    setFiltroSolicitante("");
                  }}
                  className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs hover:bg-red-500/40 transition-colors"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>

          {/* Table Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-6">
              Reservas {filtroData || filtroAuditorio || filtroSolicitante ? `(${reservasFiltradas.length} encontradas)` : ''}
            </h2>
            {reservasFiltradas.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {filtroData || filtroAuditorio || filtroSolicitante ? 'Nenhuma reserva encontrada' : 'Nenhuma reserva ainda'}
                </h3>
                <p className="text-gray-300">
                  {filtroData || filtroAuditorio || filtroSolicitante ? (
                    <>
                      Não foram encontradas reservas para os filtros aplicados.
                      {filtroData && <br />}
                      {filtroData && <span className="text-cyan-300">Data: {formatarDataParaExibicao(filtroData)}</span>}
                      {filtroAuditorio && <br />}
                      {filtroAuditorio && <span className="text-purple-300">Sala: {filtroAuditorio}</span>}
                      {filtroSolicitante && <br />}
                      {filtroSolicitante && <span className="text-green-300">Solicitante: {filtroSolicitante}</span>}
                      <br />
                      Tente ajustar os filtros ou adicione uma nova reserva.
                    </>
                  ) : (
                    'Adicione sua primeira reserva para começar!'
                  )}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="px-4 py-3 text-gray-300 font-semibold">Data</th>
                      <th className="px-4 py-3 text-gray-300 font-semibold">Horário</th>
                      <th className="px-4 py-3 text-gray-300 font-semibold">Auditório</th>
                      <th className="px-4 py-3 text-gray-300 font-semibold">Solicitante</th>
                      <th className="px-4 py-3 text-gray-300 font-semibold">Evento</th>
                      <th className="px-4 py-3 text-gray-300 font-semibold">Status</th>
                      <th className="px-4 py-3 text-gray-300 font-semibold">Observações</th>
                      <th className="px-4 py-3 text-gray-300 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservasFiltradas.map((reserva) => (
                      <tr key={reserva.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-white">{formatarDataParaExibicao(reserva.data)}</td>
                        <td className="px-4 py-3 text-white">{reserva.horario}</td>
                        <td className="px-4 py-3 text-white">{reserva.auditorio}</td>
                        <td className="px-4 py-3 text-white">{reserva.solicitante}</td>
                        <td className="px-4 py-3 text-white">{reserva.evento}</td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
                            {getStatusText()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white">{reserva.observacoes || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => editarReserva(reserva)}
                              className="w-8 h-8 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 hover:text-blue-300 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110"
                            >
                              ✏️
                            </button>
                            {showDeleteConfirm === reserva.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => deleteReserva(reserva.id)}
                                  className="w-8 h-8 bg-red-500/40 hover:bg-red-500/60 text-red-300 hover:text-red-200 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110"
                                  title="Confirmar exclusão"
                                >
                                  ✅
                                </button>
                                <button
                                  onClick={cancelarDelete}
                                  className="w-8 h-8 bg-gray-500/40 hover:bg-gray-500/60 text-gray-300 hover:text-gray-200 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110"
                                  title="Cancelar"
                                >
                                  ❌
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => confirmarDelete(reserva.id)}
                                className="w-8 h-8 bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110"
                                title="Excluir reserva"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
