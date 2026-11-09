import React, { useState, useEffect, useRef } from 'react';
import { Camera, Plus, Trash2, Coins, Sparkles, Tag, Castle, Star, X, ZoomIn, RotateCw, Check, Pencil, Image as ImageIcon, ChevronDown, ChevronRight, CircleDashed } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";

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
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [collapsedCategoriesOwned, setCollapsedCategoriesOwned] = useState({});
  
  // Nuovi stati per il Pop-up di successo
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Stati per l'editor della foto
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImage, setRawImage] = useState(null);
  const [imageDims, setImageDims] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Refs per gestire fluidamente il multi-touch (Pinch to Zoom e rotazione) da smartphone
  const pointers = useRef([]);
  const initialGesture = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [newCoin, setNewCoin] = useState({
    name: '',
    category: '',
    image: null,
    acquired: true
  });

  useEffect(() => {
    const q = query(collection(db, "coins"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const coinsData = [];
      snapshot.forEach((doc) => {
        coinsData.push({ id: doc.id, ...doc.data() });
      });
      setCoins(coinsData);
    });
    return () => unsubscribe();
  }, []);

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
          pointers.current = []; // Resetta i tocchi attivi
          setCropModalOpen(true);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  // Nuova logica Multi-Touch per l'editor foto
  const handlePointerDown = (e) => {
    e.preventDefault();
    pointers.current.push({ id: e.pointerId, x: e.clientX, y: e.clientY });

    if (pointers.current.length === 1) {
      // Un dito: trascinamento (Pan)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setIsDragging(true);
    } else if (pointers.current.length === 2) {
      // Due dita: inizio Pinch-to-Zoom e Rotazione
      const p1 = pointers.current[0];
      const p2 = pointers.current[1];
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
      initialGesture.current = { distance, angle, baseZoom: zoom, baseRotation: rotation };
    }
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    e.preventDefault();
    const index = pointers.current.findIndex(p => p.id === e.pointerId);
    if (index !== -1) {
      pointers.current[index] = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }

    if (pointers.current.length === 1 && isDragging) {
      // Muovi l'immagine
      setPan({ x: pointers.current[0].x - dragStart.x, y: pointers.current[0].y - dragStart.y });
    } else if (pointers.current.length === 2 && initialGesture.current) {
      // Zoom e Ruota con due dita
      const p1 = pointers.current[0];
      const p2 = pointers.current[1];
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);

      const scaleDelta = distance / initialGesture.current.distance;
      let newZoom = initialGesture.current.baseZoom * scaleDelta;
      newZoom = Math.min(Math.max(newZoom, 1), 5); // Limita zoom tra 1x e 5x
      setZoom(newZoom);

      const angleDelta = angle - initialGesture.current.angle;
      let newRotation = initialGesture.current.baseRotation + angleDelta;
      setRotation(newRotation);
    }
  };

  const handlePointerUp = (e) => {
    pointers.current = pointers.current.filter(p => p.id !== e.pointerId);
    if (pointers.current.length < 2) {
      initialGesture.current = null;
    }
    if (pointers.current.length === 0) {
      setIsDragging(false);
    } else if (pointers.current.length === 1) {
      // Se si alza un dito ma ne rimane un altro, riprendi a trascinare
      const p = pointers.current[0];
      setDragStart({ x: p.x - pan.x, y: p.y - pan.y });
      setIsDragging(true);
    }
  };

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

      ctx.drawImage(img, -(dw * scaleMulti) / 2, -(dh * scaleMulti) / 2, dw * scaleMulti, dh * scaleMulti);

      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      setNewCoin({ ...newCoin, image: base64 });
      setCropModalOpen(false);
      setRawImage(null);
    };
  };

  const handleAddCoin = async (e) => {
    e.preventDefault();
    if (!newCoin.name.trim()) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, "coins", editingId), {
          name: newCoin.name,
          category: newCoin.category,
          image: newCoin.image,
          acquired: newCoin.acquired
        });
        setSuccessMessage("Moneta aggiornata con successo!");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "coins"), {
          ...newCoin,
          createdAt: Date.now()
        });
        setSuccessMessage("Moneta aggiunta con successo!");
      }

      // Mostra il Popup di conferma per 3 secondi
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 3000);

      setNewCoin({ name: '', category: '', image: null, acquired: true });
    } catch (error) {
      console.error("Errore nel salvataggio:", error);
      alert("Errore di connessione al database.");
    }
  };

  // Sposta una moneta dalla wishlist al tesoro permettendo di scegliere la categoria
  const handleMoveToOwned = (coin) => {
    setEditingId(coin.id);
    setNewCoin({
      name: coin.name,
      category: coin.category || '',
      image: coin.image || null,
      acquired: true // La imposta automaticamente come posseduta
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditClick = (coin) => {
    setEditingId(coin.id);
    setNewCoin({
      name: coin.name,
      category: coin.category || '',
      image: coin.image || null,
      acquired: coin.acquired !== false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewCoin({ name: '', category: '', image: null, acquired: true });
  };

  const removeCoin = async (id) => {
    try {
      await deleteDoc(doc(db, "coins", id));
    } catch (error) {
      console.error("Errore nell'eliminazione:", error);
    }
  };

  const ownedCoinsList = coins.filter(c => c.acquired);
  const wishCoinsList = coins.filter(c => !c.acquired);

  // Raggruppa SOLO le monete possedute
  const processOwnedCoins = (coinList) => {
    const grouped = coinList.reduce((acc, coin) => {
      const cat = coin.category || 'Altre';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(coin);
      return acc;
    }, {});

    const sortedCats = Object.keys(grouped).sort();
    sortedCats.forEach(cat => grouped[cat].sort((a, b) => a.name.localeCompare(b.name)));
    
    return { grouped, sortedCats };
  };

  const ownedData = processOwnedCoins(ownedCoinsList);
  const toggleCategoryOwned = (cat) => setCollapsedCategoriesOwned(prev => ({ ...prev, [cat]: !prev[cat] }));

  const renderCoinGrid = (categoryCoins, isWishlist = false) => (
    <div className="p-4 sm:p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {categoryCoins.map((coin, index) => (
        <div 
          key={coin.id} 
          className={`relative bg-[#0a1229]/60 backdrop-blur-xl rounded-[2rem] p-4 sm:p-5 flex flex-col items-center transform transition-all duration-500 hover:-translate-y-2 group border border-white/[0.05] shadow-lg animate-fade-in-up ${isWishlist ? 'opacity-80 hover:opacity-100' : 'hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)] hover:bg-[#111c38]/80 hover:border-amber-500/20'}`}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          
          <div className="absolute top-3 left-3 right-3 flex justify-between z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={() => removeCoin(coin.id)} className="p-2 sm:p-2.5 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500/30 hover:text-red-300 shadow-sm backdrop-blur-md transition-colors active:scale-95"><Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" /></button>
            <button onClick={() => handleEditClick(coin)} className="p-2 sm:p-2.5 bg-blue-500/10 text-blue-400 rounded-full hover:bg-blue-500/30 hover:text-blue-300 shadow-sm backdrop-blur-md transition-colors active:scale-95"><Pencil className="w-4 h-4 sm:w-4.5 sm:h-4.5" /></button>
          </div>

          <div 
            className={`w-24 h-24 min-[375px]:w-28 min-[375px]:h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full p-[3px] sm:p-1 mb-4 relative shadow-2xl cursor-pointer transition-transform duration-500 mt-3 sm:mt-4 ${isWishlist ? 'bg-[#1e2a4a]' : 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 group-hover:scale-[1.08] group-hover:shadow-[0_0_30px_rgba(251,191,36,0.5)]'}`}
            onClick={() => setSelectedCoin(coin)}
          >
            <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center border-[3px] sm:border-4 inner-shadow ${isWishlist ? 'bg-[#0a1020] border-[#1e2a4a]' : 'bg-[#050811] border-[#0a1020]'}`}>
              {coin.image ? (
                <img src={coin.image} alt={coin.name} className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isWishlist ? 'grayscale opacity-60 mix-blend-luminosity' : ''}`} />
              ) : (
                <Castle className={`w-10 h-10 sm:w-14 sm:h-14 ${isWishlist ? 'text-[#1e2a4a]' : 'text-amber-500/40'}`} strokeWidth={1.5} />
              )}
            </div>
            
            {isWishlist && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleMoveToOwned(coin); }}
                className="absolute -bottom-2 -right-2 bg-gradient-to-r from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white rounded-full p-2.5 sm:p-3 shadow-[0_0_20px_rgba(16,185,129,0.5)] border-[3px] border-[#0a1229] transform transition-all duration-300 hover:scale-110 z-20 group/btn"
                title="Sposta nel Salvadanaio"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 group-hover/btn:rotate-90 transition-transform duration-300" strokeWidth={3} />
              </button>
            )}
          </div>

          <h3 className={`font-medium text-center leading-tight mt-auto pt-3 text-xs sm:text-sm md:text-base w-full border-t border-white/[0.05] transition-colors duration-300 ${isWishlist ? 'text-blue-300/60' : 'text-blue-50 group-hover:text-amber-100'}`}>{coin.name}</h3>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050814] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#111a3a] via-[#050814] to-[#020308] text-blue-50 font-sans pb-20 relative overflow-x-hidden selection:bg-amber-500/30">
      
      {showSuccessPopup && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-up">
          <div className="bg-[#0a1229]/95 backdrop-blur-2xl border border-amber-400/40 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-full px-5 py-3 sm:px-6 sm:py-3.5 flex items-center gap-3">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 animate-pulse" />
            <span className="font-medium text-blue-50 text-sm md:text-base tracking-wide whitespace-nowrap">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Sfondo Magico e Dinamico */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-600/5 rounded-full blur-[120px] animate-float" style={{animationDuration: '12s'}}></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-blue-600/5 rounded-full blur-[120px] animate-float" style={{animationDuration: '15s', animationDelay: '2s'}}></div>
        <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] animate-float" style={{animationDuration: '10s', animationDelay: '1s'}}></div>
        
        <div className="absolute top-[15%] right-[15%] text-amber-300/30 animate-pulse duration-1000"><Sparkles size={20} /></div>
        <div className="absolute top-[60%] left-[10%] text-amber-300/20 animate-pulse delay-300 duration-1000"><Star size={14} /></div>
        <div className="absolute bottom-[20%] right-[20%] text-amber-300/20 animate-pulse delay-700 duration-1000"><Sparkles size={28} /></div>
        <div className="absolute top-[40%] right-[85%] text-amber-300/10 animate-pulse delay-500 duration-1000"><Star size={10} /></div>
      </div>

      <header className="sticky top-0 z-40 pt-10 pb-5 px-4 text-center bg-[#050814]/60 backdrop-blur-2xl border-b border-white/[0.05] shadow-2xl transition-all duration-300">
        <div className="flex justify-center items-center gap-3 mb-1.5 animate-fade-in-up">
          <Coins className="text-amber-400 w-8 h-8 sm:w-9 sm:h-9 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)] animate-float" strokeWidth={1.5} style={{animationDuration: '6s'}} />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 tracking-wider font-serif drop-shadow-sm">
            DisneyCoin
          </h1>
        </div>
        <p className="text-blue-200/60 text-[9px] sm:text-[10px] md:text-xs tracking-[0.3em] uppercase font-medium flex justify-center items-center gap-2 animate-fade-in-up" style={{animationDelay: '100ms'}}>
          <Sparkles className="w-3 h-3 text-amber-400/40" /> La tua Collezione Magica <Sparkles className="w-3 h-3 text-amber-400/40" />
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12 relative z-10 space-y-12 sm:space-y-16">
        
        <section className="bg-white/[0.02] backdrop-blur-3xl rounded-[2rem] p-5 sm:p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/[0.05] relative overflow-hidden animate-fade-in-up" style={{animationDelay: '200ms'}}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent"></div>
          
          <h2 className="text-xl md:text-2xl font-serif text-amber-400 mb-6 sm:mb-8 flex items-center gap-3">
            {editingId ? <Pencil className="w-5 h-5" /> : <Castle className="w-5 h-5" />} 
            {editingId ? "Modifica Moneta" : "Aggiungi una Moneta"}
          </h2>
          
          <form onSubmit={handleAddCoin} className="flex flex-col gap-5 sm:gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              <div>
                <label className="block text-[10px] sm:text-xs text-blue-300/80 mb-2 uppercase tracking-wider font-semibold">Nome o Soggetto *</label>
                <input type="text" required placeholder="es. Topolino 30° Anniversario" className="w-full bg-[#050814]/50 border border-white/[0.08] rounded-2xl p-3.5 sm:p-4 text-blue-50 placeholder-blue-300/20 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/50 transition-all shadow-inner text-sm sm:text-base" value={newCoin.name} onChange={(e) => setNewCoin({...newCoin, name: e.target.value})} />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs text-blue-300/80 mb-2 uppercase tracking-wider font-semibold">Categoria</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-4 w-4 h-4 sm:w-5 sm:h-5 text-blue-400/50" />
                  <select className="w-full bg-[#050814]/50 border border-white/[0.08] rounded-2xl p-3.5 sm:p-4 pl-11 sm:pl-12 text-blue-50 appearance-none focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/50 transition-all shadow-inner text-sm sm:text-base" value={newCoin.category} onChange={(e) => setNewCoin({...newCoin, category: e.target.value})}>
                    <option value="" disabled className="text-blue-300/30">Seleziona la magia...</option>
                    <option value="Anno" className="bg-[#0a1229]">Anno</option>
                    <option value="Attrazione" className="bg-[#0a1229]">Attrazione</option>
                    <option value="Film" className="bg-[#0a1229]">Film</option>
                    <option value="Hotel" className="bg-[#0a1229]">Hotel</option>
                    <option value="Land" className="bg-[#0a1229]">Land</option>
                    <option value="Parco" className="bg-[#0a1229]">Parco</option>
                    <option value="Personaggi" className="bg-[#0a1229]">Personaggi</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] p-4 sm:p-5 rounded-2xl">
              <div>
                <p className="text-sm font-medium text-blue-100 cursor-pointer" onClick={() => setNewCoin({...newCoin, acquired: !newCoin.acquired})}>Aggiungi alla Wishlist</p>
                <p className="text-[10px] sm:text-xs text-blue-300/50 mt-1">Salva come moneta da cercare in futuro</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={!newCoin.acquired} onChange={(e) => setNewCoin({...newCoin, acquired: !e.target.checked})} />
                <div className="w-12 h-6 sm:w-14 sm:h-7 bg-[#111a3a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-blue-200 after:border after:rounded-full after:h-5 after:w-5 sm:after:h-6 sm:after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-400 peer-checked:to-amber-500 shadow-inner"></div>
              </label>
            </div>

            <div className="pt-2">
              <label className="block text-[10px] sm:text-xs text-blue-300/80 mb-4 uppercase tracking-wider font-semibold text-center">Foto della Moneta</label>
              <div className="flex flex-col items-center gap-5 sm:gap-6">
                {newCoin.image && (
                  <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-full overflow-hidden border-[3px] border-amber-400/80 shadow-[0_0_30px_rgba(251,191,36,0.2)] relative animate-scale-in">
                    <img src={newCoin.image} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex w-full max-w-sm gap-3 sm:gap-4">
                  <label className="flex-1 flex flex-col justify-center items-center gap-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors py-4 px-2 rounded-2xl cursor-pointer border border-white/[0.05] shadow-sm group">
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400/90 group-hover:scale-110 transition-transform duration-300" strokeWidth={1.5} />
                    <span className="font-medium text-blue-100/80 text-[10px] sm:text-xs uppercase tracking-wide">Fotocamera</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
                  </label>
                  <label className="flex-1 flex flex-col justify-center items-center gap-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors py-4 px-2 rounded-2xl cursor-pointer border border-white/[0.05] shadow-sm group">
                    <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400/90 group-hover:scale-110 transition-transform duration-300" strokeWidth={1.5} />
                    <span className="font-medium text-blue-100/80 text-[10px] sm:text-xs uppercase tracking-wide">Galleria</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-2 sm:mt-4 flex flex-col md:flex-row gap-3 sm:gap-4 pt-4 border-t border-white/[0.05]">
              {editingId && (
                <button type="button" onClick={cancelEdit} className="w-full md:w-1/3 bg-white/[0.03] hover:bg-white/[0.08] text-blue-100/80 font-semibold py-3.5 sm:py-4 rounded-full border border-white/[0.1] flex justify-center items-center gap-2 transition-colors active:scale-[0.98]">
                  <X className="w-4 h-4 sm:w-5 sm:h-5" /> Annulla
                </button>
              )}
              <button type="submit" className={`w-full ${editingId ? 'md:w-2/3' : ''} bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#050814] font-bold py-3.5 sm:py-4 rounded-full shadow-[0_10px_25px_rgba(251,191,36,0.3)] hover:shadow-[0_15px_30px_rgba(251,191,36,0.4)] flex justify-center items-center gap-2 transition-all transform active:scale-[0.98] text-sm sm:text-base`}>
                {editingId ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />}
                {editingId ? "Salva Modifiche" : "Aggiungi Moneta"}
              </button>
            </div>
          </form>
        </section>

        <section className="pt-4 sm:pt-6">
          <div className="flex justify-between items-end mb-6 sm:mb-8 px-2">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-serif text-blue-50 flex items-center gap-2 sm:gap-3 animate-fade-in-up">
              <Castle className="text-amber-400 w-6 h-6 sm:w-7 sm:h-7" /> Le tue Monete
            </h2>
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-inner animate-fade-in-up">
              <span className="text-amber-400 font-bold text-xs sm:text-sm">{ownedCoinsList.length}</span>
            </div>
          </div>

          {ownedCoinsList.length === 0 ? (
            <div className="text-center py-16 sm:py-20 bg-white/[0.02] rounded-[2rem] border border-dashed border-white/[0.1] backdrop-blur-sm animate-fade-in-up">
              <Castle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-blue-400/20 mb-3 sm:mb-4" strokeWidth={1} />
              <p className="text-base sm:text-lg font-serif text-blue-200/50">Il castello è ancora vuoto.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:gap-6">
              {ownedData.sortedCats.map((category, index) => (
                <div key={category} className="bg-white/[0.02] backdrop-blur-xl rounded-[1.5rem] sm:rounded-3xl border border-white/[0.05] overflow-hidden shadow-lg animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <button onClick={() => toggleCategoryOwned(category)} className="w-full flex justify-between items-center p-4 sm:p-5 md:px-8 md:py-6 hover:bg-white/[0.04] transition-colors group">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400/60 group-hover:text-amber-400 transition-colors" />
                      <h3 className="text-sm sm:text-base md:text-lg font-semibold text-blue-50/90 tracking-wider uppercase font-serif">{category}</h3>
                      <span className="bg-[#050814]/80 text-amber-400/90 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-white/[0.05]">{ownedData.grouped[category].length}</span>
                    </div>
                    {collapsedCategoriesOwned[category] ? <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400/50 group-hover:text-blue-400/80 transition-colors" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400/50 group-hover:text-blue-400/80 transition-colors" />}
                  </button>
                  {!collapsedCategoriesOwned[category] && (
                    <div className="border-t border-white/[0.05] bg-[#020308]/20">
                      {renderCoinGrid(ownedData.grouped[category], false)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pt-8 pb-12">
          <div className="flex justify-between items-end mb-6 sm:mb-8 px-2">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-serif text-blue-200/70 flex items-center gap-2 sm:gap-3 animate-fade-in-up">
              <Star className="text-blue-400/60 w-6 h-6 sm:w-7 sm:h-7" /> Lista dei Desideri
            </h2>
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-inner animate-fade-in-up">
              <span className="text-blue-300/80 font-bold text-xs sm:text-sm">{wishCoinsList.length}</span>
            </div>
          </div>

          {wishCoinsList.length === 0 ? (
            <div className="text-center py-12 sm:py-16 bg-white/[0.02] rounded-[2rem] border border-dashed border-white/[0.1] backdrop-blur-sm animate-fade-in-up">
              <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-blue-400/20 mb-3 sm:mb-4" strokeWidth={1} />
              <p className="text-sm sm:text-base font-serif text-blue-200/40">Non stai cercando nessuna moneta al momento.</p>
            </div>
          ) : (
            <div className="bg-white/[0.01] backdrop-blur-xl rounded-[1.5rem] sm:rounded-3xl border border-white/[0.05] overflow-hidden shadow-lg animate-fade-in-up">
              {renderCoinGrid(wishCoinsList, true)}
            </div>
          )}
        </section>
      </main>
      
      {cropModalOpen && rawImage && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#050814]/95 backdrop-blur-2xl p-4 animate-scale-in">
          <div className="w-full max-w-sm bg-[#0a1229] border border-white/[0.08] p-6 sm:p-8 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.9)] flex flex-col items-center">
            <h3 className="text-base sm:text-lg font-serif text-amber-400 mb-6 sm:mb-8 flex items-center gap-2"><Camera className="w-4 h-4 sm:w-5 sm:h-5" /> Inquadra la Magia</h3>
            
            <div className="relative w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] rounded-full overflow-hidden border-[3px] sm:border-4 border-amber-400/70 touch-none mx-auto bg-[#050814] shadow-inner mb-8 sm:mb-10 cursor-move" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onPointerCancel={handlePointerUp}>
              <img src={rawImage} alt="Da ritagliare" style={{ position: 'absolute', top: '50%', left: '50%', width: `${imageDims.width * Math.max(280/imageDims.width, 280/imageDims.height)}px`, height: `${imageDims.height * Math.max(280/imageDims.width, 280/imageDims.height)}px`, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) rotate(${rotation}deg) scale(${zoom})`, transformOrigin: 'center center', maxWidth: 'none', pointerEvents: 'none' }} draggable={false} />
              <div className="absolute inset-0 border-[3px] border-[#050814]/60 rounded-full pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.9)]"></div>
            </div>
            
            <div className="w-full space-y-5 sm:space-y-6 mb-8 sm:mb-10">
              <div className="flex items-center gap-3 sm:gap-4"><ZoomIn className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400/70" /><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full accent-amber-500 h-1 sm:h-1.5 bg-white/[0.05] rounded-lg appearance-none" /></div>
              <div className="flex items-center gap-3 sm:gap-4"><RotateCw className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400/70" /><input type="range" min="-180" max="180" step="1" value={rotation} onChange={(e) => setRotation(parseFloat(e.target.value))} className="w-full accent-amber-500 h-1 sm:h-1.5 bg-white/[0.05] rounded-lg appearance-none" /></div>
            </div>
            <div className="flex w-full gap-3 sm:gap-4">
              <button onClick={() => setCropModalOpen(false)} className="flex-1 py-3 sm:py-3.5 px-4 rounded-full bg-white/[0.03] text-blue-200/80 hover:bg-white/[0.08] font-semibold flex justify-center items-center gap-2 transition-colors active:scale-95 text-sm sm:text-base"><X className="w-4 h-4 sm:w-5 sm:h-5" /> Annulla</button>
              <button onClick={confirmCrop} className="flex-1 py-3 sm:py-3.5 px-4 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 text-[#050814] font-bold flex justify-center items-center gap-2 transition-all active:scale-95 text-sm sm:text-base"><Check className="w-4 h-4 sm:w-5 sm:h-5" /> Conferma</button>
            </div>
          </div>
        </div>
      )}

      {selectedCoin && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#050814]/95 backdrop-blur-2xl p-4 animate-fade-in-up" onClick={() => setSelectedCoin(null)}>
          <div className="relative flex flex-col items-center max-w-md w-full animate-scale-in" onClick={e => e.stopPropagation()}>
            <button className="absolute -top-14 sm:-top-16 right-0 p-2.5 sm:p-3 text-blue-200/60 hover:text-white bg-white/5 rounded-full backdrop-blur-md transition-colors active:scale-95" onClick={() => setSelectedCoin(null)}><X className="w-5 h-5 sm:w-6 sm:h-6" /></button>
            
            <div className={`w-64 h-64 min-[375px]:w-72 min-[375px]:h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full p-[4px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] ${!selectedCoin.acquired ? 'bg-[#1e2a4a]' : 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600'}`}>
              <div className="w-full h-full rounded-full bg-[#020308] overflow-hidden flex items-center justify-center border-[3px] sm:border-4 border-[#050814] inner-shadow">
                {selectedCoin.image ? (
                  <img src={selectedCoin.image} alt={selectedCoin.name} className={`w-full h-full object-cover ${!selectedCoin.acquired ? 'grayscale opacity-50 mix-blend-luminosity' : ''}`} />
                ) : (
                  <Castle className="w-20 h-20 sm:w-24 sm:h-24 text-[#111a3a]" strokeWidth={1} />
                )}
              </div>
            </div>
            
            <div className="mt-8 sm:mt-10 text-center bg-[#0a1229]/80 backdrop-blur-xl border border-white/[0.05] px-6 sm:px-8 py-5 sm:py-6 rounded-[2rem] shadow-2xl w-full relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-24 sm:w-32 h-24 sm:h-32 bg-amber-500/10 rounded-full blur-3xl"></div>
              
              <h3 className="text-xl sm:text-2xl md:text-3xl font-serif text-blue-50 mb-1.5 sm:mb-2 relative z-10">{selectedCoin.name}</h3>
              <p className="text-amber-400/80 text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-1.5 sm:mb-2 relative z-10 flex justify-center items-center gap-2">
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {selectedCoin.category} <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </p>
              {!selectedCoin.acquired && <p className="text-blue-300/50 text-xs sm:text-sm mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-center gap-1.5 sm:gap-2 relative z-10"><Star className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Wishlist</p>}
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .inner-shadow { box-shadow: inset 0 4px 25px rgba(0,0,0,0.9); }
        ::-webkit-scrollbar { width: 0px; background: transparent; }
        
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-in { animation: scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }

        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-15px) scale(1.02); }
        }
        .animate-float { animation: float ease-in-out infinite; }
      `}} />
    </div>
  );
}
