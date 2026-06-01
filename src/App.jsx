import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, Plus, Trash2, Calendar, Coins, Sparkles, Tag, Castle, Star, X, ZoomIn, RotateCw, Check } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";

// Il tuo collegamento personale a Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDsCb4p2Ok6SePqcHjmbOWYX7T876SVaOM",
  authDomain: "disneycoin-d81d2.firebaseapp.com",
  projectId: "disneycoin-d81d2",
  storageBucket: "disneycoin-d81d2.firebasestorage.app",
  messagingSenderId: "1016544434633",
  appId: "1:1016544434633:web:e84a26c8f81e4e68fb3018"
};

// Inizializziamo il Database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  const [coins, setCoins] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState(null); // Stato per lo zoom della moneta
  
  // Stati per l'editor della foto
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImage, setRawImage] = useState(null);
  const [imageDims, setImageDims] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [newCoin, setNewCoin] = useState({
    name: '',
    category: '',
    year: new Date().getFullYear().toString(),
    image: null
  });

  // Carica le monete da Firebase all'avvio
  useEffect(() => {
    const q = query(collection(db, "coins"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const coinsData = [];
      snapshot.forEach((doc) => {
        coinsData.push({ id: doc.id, ...doc.data() });
      });
      setCoins(coinsData);
    });
    
    return () => unsubscribe(); // Pulisce l'ascolto quando si chiude la pagina
  }, []);

  // Gestisce l'acquisizione dell'immagine e apre l'editor
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result;
        img.onload = () => {
          setRawImage(reader.result);
          setImageDims({ width: img.width, height: img.height });
          setZoom(1);
          setRotation(0);
          setPan({ x: 0, y: 0 });
          setCropModalOpen(true);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  // Gestione del trascinamento (Pan)
  const handlePointerDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Conferma e ritaglia l'immagine
  const confirmCrop = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const UI_SIZE = 280; 
    const OUT_SIZE = 600; 
    const scaleMulti = OUT_SIZE / UI_SIZE;

    canvas.width = OUT_SIZE;
    canvas.height = OUT_SIZE;

    const img = new Image();
    img.src = rawImage;
    img.onload = () => {
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);

      const baseScale = Math.max(UI_SIZE / img.width, UI_SIZE / img.height);
      const dw = img.width * baseScale;
      const dh = img.height * baseScale;

      ctx.translate(OUT_SIZE / 2, OUT_SIZE / 2); 
      ctx.translate(pan.x * scaleMulti, pan.y * scaleMulti); 
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      ctx.drawImage(
        img,
        -(dw * scaleMulti) / 2,
        -(dh * scaleMulti) / 2,
        dw * scaleMulti,
        dh * scaleMulti
      );

      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      setNewCoin({ ...newCoin, image: base64 });
      setCropModalOpen(false);
      setRawImage(null);
    };
  };

  // Salva la nuova moneta su Firebase
  const handleAddCoin = async (e) => {
    e.preventDefault();
    if (!newCoin.name.trim()) return;

    try {
      await addDoc(collection(db, "coins"), {
        name: newCoin.name,
        category: newCoin.category,
        year: newCoin.year,
        image: newCoin.image,
        acquired: true,
        createdAt: Date.now()
      });
      
      // Resetta il form
      setNewCoin({
        name: '',
        category: '',
        year: new Date().getFullYear().toString(),
        image: null
      });
    } catch (error) {
      console.error("Errore nel salvataggio:", error);
      alert("Errore di connessione al database. Riprova tra poco.");
    }
  };

  // Elimina la moneta da Firebase
  const removeCoin = async (id) => {
    try {
      await deleteDoc(doc(db, "coins", id));
    } catch (error) {
      console.error("Errore nell'eliminazione:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#071022] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a3059] via-[#071022] to-[#030712] text-white font-sans pb-12 relative overflow-hidden">
      
      {/* Sfondo Magico (Stelle decorative) */}
      <div className="absolute top-10 left-10 text-amber-300/20 animate-pulse"><Star size={24} /></div>
      <div className="absolute top-40 right-20 text-amber-300/20 animate-pulse delay-150"><Star size={16} /></div>
      <div className="absolute top-80 left-1/4 text-amber-300/10 animate-pulse delay-300"><Star size={32} /></div>

      {/* Header ispirato a Disneyland Paris */}
      <header className="pt-14 pb-8 px-4 text-center bg-[#040B16]/60 border-b border-amber-500/20 backdrop-blur-md relative z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex justify-center items-center gap-3 mb-3">
          <Castle className="text-amber-400 w-10 h-10 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" strokeWidth={1.5} />
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 tracking-wide font-serif">
            Magiche Monete
          </h1>
        </div>
        <p className="text-amber-100/70 text-xs md:text-sm tracking-[0.2em] uppercase font-semibold">
          La tua Collezione Disneyland Paris
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-10 relative z-10">
        
        {/* Form per aggiungere una nuova moneta */}
        <section className="bg-[#0f274d]/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl border border-[#1d3d6e] mb-12 relative overflow-hidden">
          {/* Effetto luce angolo */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl"></div>

          <h2 className="text-2xl font-serif text-amber-400 mb-6 flex items-center gap-2 border-b border-[#1d3d6e] pb-4">
            <Sparkles className="w-5 h-5" /> 
            Aggiungi una Scoperta
          </h2>
          
          <form onSubmit={handleAddCoin} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm text-blue-200 mb-2 font-medium tracking-wide">Nome o Soggetto *</label>
              <input 
                type="text" 
                required
                placeholder="es. Topolino 30° Anniversario"
                className="w-full bg-[#071022] border border-[#1d3d6e] rounded-xl p-3.5 text-white placeholder-blue-400/30 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
                value={newCoin.name}
                onChange={(e) => setNewCoin({...newCoin, name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm text-blue-200 mb-2 font-medium tracking-wide">Categoria</label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-3.5 w-5 h-5 text-amber-400/70" />
                  <select 
                    className="w-full bg-[#071022] border border-[#1d3d6e] rounded-xl p-3.5 pl-11 text-white appearance-none focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
                    value={newCoin.category}
                    onChange={(e) => setNewCoin({...newCoin, category: e.target.value})}
                  >
                    <option value="" disabled className="text-gray-500">Seleziona la magia...</option>
                    <option value="Anno" className="text-gray-900 bg-white">Anno</option>
                    <option value="Attrazione" className="text-gray-900 bg-white">Attrazione</option>
                    <option value="Film" className="text-gray-900 bg-white">Film</option>
                    <option value="Personaggi" className="text-gray-900 bg-white">Personaggi</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-blue-200 mb-2 font-medium tracking-wide">Anno di conio</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3.5 w-5 h-5 text-amber-400/70" />
                  <input 
                    type="text" 
                    className="w-full bg-[#071022] border border-[#1d3d6e] rounded-xl p-3.5 pl-11 text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
                    value={newCoin.year}
                    onChange={(e) => setNewCoin({...newCoin, year: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Sezione Foto */}
            <div className="pt-2">
              <label className="block text-sm text-blue-200 mb-4 font-medium tracking-wide text-center">Foto della Moneta</label>
              <div className="flex flex-col items-center gap-4">
                
                {/* Grande anteprima circolare */}
                {newCoin.image && (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] relative">
                    <img src={newCoin.image} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}

                <label className="w-full flex justify-center items-center gap-2 bg-[#1a3059] hover:bg-[#233f75] transition-colors py-3.5 px-4 rounded-xl cursor-pointer border border-[#2a4a8a] shadow-md group">
                  <Camera className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-amber-50">
                    {newCoin.image ? "Cambia Foto" : "Scatta o Carica Foto"}
                  </span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                    onChange={handleImageChange}
                  />
                </label>
              </div>
            </div>

            <button 
              type="submit" 
              className="mt-6 w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#071022] font-bold py-4 rounded-full shadow-[0_0_20px_rgba(251,191,36,0.2)] flex justify-center items-center gap-2 transition-all active:scale-[0.98] uppercase tracking-wider text-sm"
            >
              <Coins className="w-5 h-5" />
              Conserva nel Portamonete Magico
            </button>
          </form>
        </section>

        {/* Griglia della Collezione */}
        <section>
          <div className="flex justify-between items-end mb-6 border-b border-[#1d3d6e] pb-3">
            <h2 className="text-3xl font-serif text-white">Il Tuo Tesoro</h2>
            <div className="flex items-center gap-2 bg-[#0f274d] border border-[#1d3d6e] px-4 py-1.5 rounded-full shadow-inner">
              <span className="text-amber-400 font-bold">{coins.length}</span>
              <span className="text-blue-200 text-xs uppercase tracking-wider">Monete</span>
            </div>
          </div>

          {coins.length === 0 ? (
            <div className="text-center py-16 bg-[#0f274d]/40 rounded-3xl border border-dashed border-[#1d3d6e]">
              <Castle className="w-20 h-20 mx-auto text-blue-500/20 mb-4" strokeWidth={1} />
              <p className="text-xl font-serif text-amber-100/70">Il forziere è ancora vuoto.</p>
              <p className="text-sm text-blue-300/50 mt-2">Aggiungi la tua prima moneta per iniziare la magia!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {coins.map(coin => (
                <div key={coin.id} className="relative bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] p-5 flex flex-col items-center transform transition-all hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(251,191,36,0.15)] group border border-amber-100">
                  
                  {/* Tasto elimina */}
                  <button 
                    onClick={() => removeCoin(coin.id)}
                    className="absolute top-3 left-3 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-100 hover:text-red-600 shadow-sm"
                    title="Rimuovi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Immagine Moneta (Stile Medaglione) con Zoom */}
                  <div 
                    className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-1 mb-5 relative shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setSelectedCoin(coin)}
                    title="Clicca per ingrandire"
                  >
                    <div className="w-full h-full rounded-full bg-[#f8f9fa] overflow-hidden flex items-center justify-center border-2 border-white inner-shadow">
                      {coin.image ? (
                        <img src={coin.image} alt={coin.name} className="w-full h-full object-cover" />
                      ) : (
                        <Castle className="w-12 h-12 text-amber-500/30" />
                      )}
                    </div>
                    
                    {/* Spunta Verde Magica */}
                    {coin.acquired && (
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-xl animate-bounce-short border border-gray-100">
                        <CheckCircle className="w-7 h-7 text-green-500 drop-shadow-sm" fill="#e8f5e9" />
                      </div>
                    )}
                  </div>

                  {/* Dettagli */}
                  <h3 className="font-bold text-[#071022] text-center leading-tight mb-2 text-sm md:text-base">{coin.name}</h3>
                  {coin.category && (
                    <span className="text-[10px] uppercase tracking-wider text-[#0f274d] font-bold bg-amber-100/80 border border-amber-200 rounded-full px-3 py-1 w-max mx-auto mb-2 flex items-center gap-1">
                      {coin.category}
                    </span>
                  )}
                  <p className="text-xs text-amber-600 font-bold mt-auto pt-2 border-t border-gray-100 w-full text-center">{coin.year}</p>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
      
      {/* Modal per lo Zoom della Moneta */}
      {selectedCoin && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071022]/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedCoin(null)}
        >
          <div 
            className="relative flex flex-col items-center max-w-lg w-full transform transition-all scale-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Tasto Chiudi */}
            <button 
              className="absolute -top-12 right-0 p-2 text-amber-100 hover:text-amber-400 transition-colors bg-white/10 rounded-full"
              onClick={() => setSelectedCoin(null)}
            >
              <X className="w-6 h-6" />
            </button>

            {/* Immagine Ingrandita */}
            <div className="w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-2 shadow-[0_0_40px_rgba(251,191,36,0.3)]">
              <div className="w-full h-full rounded-full bg-[#f8f9fa] overflow-hidden flex items-center justify-center border-4 border-white inner-shadow">
                {selectedCoin.image ? (
                  <img src={selectedCoin.image} alt={selectedCoin.name} className="w-full h-full object-cover" />
                ) : (
                  <Castle className="w-24 h-24 text-amber-500/30" />
                )}
              </div>
            </div>

            {/* Dettagli nel Modal */}
            <div className="mt-8 text-center bg-[#0f274d]/80 border border-[#1d3d6e] px-8 py-5 rounded-3xl shadow-xl w-full">
              <h3 className="text-3xl font-serif text-amber-400 mb-3">{selectedCoin.name}</h3>
              <div className="flex justify-center items-center gap-3 text-sm text-blue-200">
                {selectedCoin.category && (
                  <span className="flex items-center gap-1 bg-amber-500/10 text-amber-300 px-4 py-1.5 rounded-full border border-amber-500/20 font-medium">
                    <Tag className="w-3.5 h-3.5" /> {selectedCoin.category}
                  </span>
                )}
                <span className="flex items-center gap-1 text-amber-100 font-medium">
                  <Calendar className="w-4 h-4 text-amber-400/70" /> {selectedCoin.year}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editor Foto (Ritaglia, Zoom, Ruota) */}
      {cropModalOpen && rawImage && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#030712]/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#0f274d]/90 border border-[#1d3d6e] p-6 rounded-3xl shadow-2xl flex flex-col items-center">
            
            <h3 className="text-xl font-serif text-amber-400 mb-6 flex items-center gap-2">
              <Camera className="w-5 h-5" /> Inquadra la Moneta
            </h3>

            {/* Area di Ritaglio */}
            <div 
              className="relative w-[280px] h-[280px] rounded-full overflow-hidden border-4 border-amber-400 touch-none mx-auto bg-black/50 shadow-inner mb-8 cursor-move"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <img
                src={rawImage}
                alt="Da ritagliare"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: `${imageDims.width * Math.max(280/imageDims.width, 280/imageDims.height)}px`,
                  height: `${imageDims.height * Math.max(280/imageDims.width, 280/imageDims.height)}px`,
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) rotate(${rotation}deg) scale(${zoom})`,
                  transformOrigin: 'center center',
                  maxWidth: 'none',
                  pointerEvents: 'none' // Per evitare conflitti col trascinamento
                }}
                draggable={false}
              />
              <div className="absolute inset-0 border-2 border-white/20 rounded-full pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"></div>
            </div>

            {/* Controlli Zoom e Rotazione */}
            <div className="w-full space-y-5 mb-8">
              <div className="flex items-center gap-3">
                <ZoomIn className="w-5 h-5 text-amber-400/70" />
                <input 
                  type="range" min="1" max="3" step="0.05" value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 h-2 bg-[#1a3059] rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-3">
                <RotateCw className="w-5 h-5 text-amber-400/70" />
                <input 
                  type="range" min="-180" max="180" step="1" value={rotation}
                  onChange={(e) => setRotation(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 h-2 bg-[#1a3059] rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <p className="text-xs text-blue-300 text-center italic mt-2">Trascina la foto per centrarla</p>
            </div>

            {/* Pulsanti Azione */}
            <div className="flex w-full gap-3">
              <button 
                onClick={() => setCropModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold flex justify-center items-center gap-2 transition-colors"
              >
                <X className="w-5 h-5" /> Annulla
              </button>
              <button 
                onClick={confirmCrop}
                className="flex-1 py-3 px-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold flex justify-center items-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <Check className="w-5 h-5" /> Conferma
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Stile extra per piccole animazioni e ombre */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-15%) scale(1.1); }
        }
        .animate-bounce-short {
          animation: bounce-short 0.8s ease-out 1;
        }
        .inner-shadow {
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.1);
        }
      `}} />
    </div>
  );
}
