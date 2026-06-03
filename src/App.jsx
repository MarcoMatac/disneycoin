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
    <div className={`p-4 md:p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 ${isWishlist ? '' : 'bg-[#071022]/40'}`}>
      {categoryCoins.map(coin => (
        <div key={coin.id} className={`relative bg-[#0f274d]/60 backdrop-blur-sm rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] p-5 flex flex-col items-center transform transition-all hover:-translate-y-2 group border border-[#1d3d6e] ${isWishlist ? 'opacity-60 hover:opacity-100' : 'hover:shadow-[0_15px_40px_rgba(251,191,36,0.15)]'}`}>
          
          <div className="absolute top-3 left-3 right-3 flex justify-between z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => removeCoin(coin.id)} className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40 shadow-sm transition-colors"><Trash2 className="w-4 h-4" /></button>
            <button onClick={() => handleEditClick(coin)} className="p-2 bg-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/40 shadow-sm transition-colors"><Pencil className="w-4 h-4" /></button>
          </div>

          <div 
            className={`w-28 h-28 md:w-32 md:h-32 rounded-full p-1 mb-5 relative shadow-lg cursor-pointer transition-transform mt-2 ${isWishlist ? 'bg-gray-600' : 'bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 hover:scale-105'}`}
            onClick={() => setSelectedCoin(coin)}
          >
            <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center border-2 inner-shadow ${isWishlist ? 'bg-[#1a3059] border-gray-500' : 'bg-[#030712] border-[#1a3059]'}`}>
              {coin.image ? (
                <img src={coin.image} alt={coin.name} className={`w-full h-full object-cover ${isWishlist ? 'grayscale sepia-[.3]' : ''}`} />
              ) : (
                <Castle className={`w-12 h-12 ${isWishlist ? 'text-gray-400/30' : 'text-amber-500/30'}`} />
              )}
            </div>
            
            {/* Pulsante per spostare nel salvadanaio (solo wishlist) */}
            {isWishlist && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleMoveToOwned(coin); }}
                className="absolute -bottom-2 -right-2 bg-green-500/90 hover:bg-green-400 text-white rounded-full p-2.5 shadow-xl border-2 border-[#0f274d] transform transition-transform hover:scale-110 z-20 group/btn"
                title="Sposta nel Salvadanaio"
              >
                <Plus className="w-5 h-5 group-hover/btn:rotate-90 transition-transform" strokeWidth={3} />
              </button>
            )}
          </div>

          <h3 className={`font-bold text-center leading-tight mt-auto pt-2 text-sm md:text-base ${isWishlist ? 'text-gray-300' : 'text-white'}`}>{coin.name}</h3>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#071022] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a3059] via-[#071022] to-[#030712] text-white font-sans pb-12 relative overflow-hidden">
      
      {/* Pop-up animato di successo */}
      {showSuccessPopup && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-10 fade-in duration-300">
          <div className="bg-[#0f274d]/95 backdrop-blur-md border border-amber-400/50 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-full px-6 py-3 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-white text-sm md:text-base">{successMessage}</span>
          </div>
        </div>
      )}

      <div className="absolute top-10 left-10 text-amber-300/20 animate-pulse"><Star size={24} /></div>
      <div className="absolute top-40 right-20 text-amber-300/20 animate-pulse delay-150"><Star size={16} /></div>
      <div className="absolute top-80 left-1/4 text-amber-300/10 animate-pulse delay-300"><Star size={32} /></div>

      <header className="pt-14 pb-8 px-4 text-center bg-[#040B16]/60 border-b border-amber-500/20 backdrop-blur-md relative z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex justify-center items-center gap-3 mb-3">
          <Coins className="text-amber-400 w-10 h-10 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" strokeWidth={1.5} />
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 tracking-wide font-serif">
            DisneyCoin
          </h1>
        </div>
        <p className="text-amber-100/70 text-xs md:text-sm tracking-[0.2em] uppercase font-semibold">La tua Collezione Disneyland Paris</p>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-10 relative z-10 space-y-16">
        
        {/* Form Aggiungi/Modifica */}
        <section className="bg-[#0f274d]/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl border border-[#1d3d6e] relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl"></div>

          <h2 className="text-2xl font-serif text-amber-400 mb-6 flex items-center gap-2 border-b border-[#1d3d6e] pb-4">
            {editingId ? <Pencil className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />} 
            {editingId ? "Modifica Moneta" : "Aggiungi una Moneta"}
          </h2>
          
          <form onSubmit={handleAddCoin} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm text-blue-200 mb-2 font-medium tracking-wide">Nome o Soggetto *</label>
              <input type="text" required placeholder="es. Topolino 30° Anniversario" className="w-full bg-[#071022] border border-[#1d3d6e] rounded-xl p-3.5 text-white placeholder-blue-400/30 focus:outline-none focus:border-amber-400" value={newCoin.name} onChange={(e) => setNewCoin({...newCoin, name: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm text-blue-200 mb-2 font-medium tracking-wide">Categoria</label>
              <div className="relative">
                <Tag className="absolute left-3.5 top-3.5 w-5 h-5 text-amber-400/70" />
                <select className="w-full bg-[#071022] border border-[#1d3d6e] rounded-xl p-3.5 pl-11 text-white appearance-none focus:outline-none focus:border-amber-400" value={newCoin.category} onChange={(e) => setNewCoin({...newCoin, category: e.target.value})}>
                  <option value="" disabled className="text-gray-500">Seleziona...</option>
                  <option value="Anno" className="text-gray-900 bg-white">Anno</option>
                  <option value="Attrazione" className="text-gray-900 bg-white">Attrazione</option>
                  <option value="Film" className="text-gray-900 bg-white">Film</option>
                  <option value="Hotel" className="text-gray-900 bg-white">Hotel</option>
                  <option value="Land" className="text-gray-900 bg-white">Land</option>
                  <option value="Parco" className="text-gray-900 bg-white">Parco</option>
                  <option value="Personaggi" className="text-gray-900 bg-white">Personaggi</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#1a3059]/50 border border-[#2a4a8a] p-4 rounded-xl mt-2">
              <label className="text-sm font-medium text-amber-50 cursor-pointer" htmlFor="wishlist-toggle">
                Aggiungi alla Wishlist
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input id="wishlist-toggle" type="checkbox" className="sr-only peer" checked={!newCoin.acquired} onChange={(e) => setNewCoin({...newCoin, acquired: !e.target.checked})} />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>

            <div className="pt-2">
              <label className="block text-sm text-blue-200 mb-4 font-medium tracking-wide text-center">Foto della Moneta</label>
              <div className="flex flex-col items-center gap-4">
                {newCoin.image && (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                    <img src={newCoin.image} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex w-full gap-3">
                  <label className="flex-1 flex justify-center items-center gap-2 bg-[#1a3059] hover:bg-[#233f75] transition-colors py-3.5 px-2 rounded-xl cursor-pointer border border-[#2a4a8a] shadow-md group">
                    <Camera className="w-5 h-5 text-amber-400 group-hover:scale-110" />
                    <span className="font-medium text-amber-50 text-sm">Fotocamera</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
                  </label>
                  <label className="flex-1 flex justify-center items-center gap-2 bg-[#1a3059] hover:bg-[#233f75] transition-colors py-3.5 px-2 rounded-xl cursor-pointer border border-[#2a4a8a] shadow-md group">
                    <ImageIcon className="w-5 h-5 text-amber-400 group-hover:scale-110" />
                    <span className="font-medium text-amber-50 text-sm">Galleria</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col md:flex-row gap-3">
              {editingId && (
                <button type="button" onClick={cancelEdit} className="w-full md:w-1/3 bg-[#1a3059] hover:bg-[#233f75] text-white font-bold py-4 rounded-full shadow-lg border border-[#2a4a8a] flex justify-center items-center gap-2">
                  <X className="w-5 h-5" /> Annulla
                </button>
              )}
              <button type="submit" className={`w-full ${editingId ? 'md:w-2/3' : ''} bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-[#071022] font-bold py-4 rounded-full shadow-[0_0_20px_rgba(251,191,36,0.2)] flex justify-center items-center gap-2`}>
                {editingId ? <Check className="w-5 h-5" /> : <Coins className="w-5 h-5" />}
                {editingId ? "Salva Modifiche" : "Aggiungi Moneta"}
              </button>
            </div>
          </form>
        </section>

        {/* SEZIONE 1: IL TUO TESORO */}
        <section>
          <div className="flex justify-between items-end mb-6 border-b border-amber-500/30 pb-3">
            <h2 className="text-3xl font-serif text-white flex items-center gap-3"><Coins className="text-amber-400" /> Le tue Monete</h2>
            <div className="flex items-center gap-2 bg-[#0f274d] border border-amber-500/30 px-4 py-1.5 rounded-full shadow-inner">
              <span className="text-amber-400 font-bold">{ownedCoinsList.length}</span>
            </div>
          </div>

          {ownedCoinsList.length === 0 ? (
            <div className="text-center py-16 bg-[#0f274d]/40 rounded-3xl border border-dashed border-[#1d3d6e]">
              <Castle className="w-20 h-20 mx-auto text-blue-500/20 mb-4" strokeWidth={1} />
              <p className="text-xl font-serif text-amber-100/70">Il salvadanaio è vuoto.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {ownedData.sortedCats.map(category => (
                <div key={category} className="bg-[#0f274d]/30 backdrop-blur-md rounded-2xl border border-[#1d3d6e] overflow-hidden shadow-lg">
                  <button onClick={() => toggleCategoryOwned(category)} className="w-full flex justify-between items-center p-4 md:px-6 md:py-4 bg-[#1a3059]/60 hover:bg-[#1a3059] group">
                    <div className="flex items-center gap-3">
                      <Tag className="w-5 h-5 text-amber-400" />
                      <h3 className="text-lg font-bold text-white tracking-wide uppercase">{category}</h3>
                      <span className="bg-[#030712] text-amber-400 text-xs font-bold px-3 py-1 rounded-full">{ownedData.grouped[category].length}</span>
                    </div>
                    {collapsedCategoriesOwned[category] ? <ChevronRight className="w-6 h-6 text-amber-400/70" /> : <ChevronDown className="w-6 h-6 text-amber-400/70" />}
                  </button>
                  {!collapsedCategoriesOwned[category] && renderCoinGrid(ownedData.grouped[category], false)}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SEZIONE 2: LISTA DEI DESIDERI (WISHLIST) */}
        <section className="pt-8">
          <div className="flex justify-between items-end mb-6 border-b border-blue-500/30 pb-3">
            <h2 className="text-3xl font-serif text-gray-300 flex items-center gap-3"><Star className="text-blue-400" /> Lista dei Desideri</h2>
            <div className="flex items-center gap-2 bg-[#0f274d]/50 border border-blue-500/30 px-4 py-1.5 rounded-full shadow-inner">
              <span className="text-blue-400 font-bold">{wishCoinsList.length}</span>
            </div>
          </div>

          {wishCoinsList.length === 0 ? (
            <div className="text-center py-12 bg-[#0f274d]/20 rounded-3xl border border-dashed border-[#1d3d6e]/50">
              <CircleDashed className="w-16 h-16 mx-auto text-blue-500/20 mb-4" strokeWidth={1} />
              <p className="text-lg font-serif text-blue-200/50">Non stai cercando nessuna moneta al momento.</p>
            </div>
          ) : (
            <div className="bg-[#0f274d]/20 backdrop-blur-md rounded-2xl border border-[#1d3d6e]/50 overflow-hidden shadow-lg">
              {renderCoinGrid(wishCoinsList, true)}
            </div>
          )}
        </section>

      </main>
      
      {/* Modal Editor Foto */}
      {cropModalOpen && rawImage && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#030712]/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#0f274d]/90 border border-[#1d3d6e] p-6 rounded-3xl shadow-2xl flex flex-col items-center">
            <h3 className="text-xl font-serif text-amber-400 mb-6 flex items-center gap-2"><Camera className="w-5 h-5" /> Inquadra la Moneta</h3>
            
            {/* Aggiunto onPointerCancel per maggiore stabilità sui tocchi da mobile */}
            <div className="relative w-[280px] h-[280px] rounded-full overflow-hidden border-4 border-amber-400 touch-none mx-auto bg-black/50 shadow-inner mb-8 cursor-move" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onPointerCancel={handlePointerUp}>
              <img src={rawImage} alt="Da ritagliare" style={{ position: 'absolute', top: '50%', left: '50%', width: `${imageDims.width * Math.max(280/imageDims.width, 280/imageDims.height)}px`, height: `${imageDims.height * Math.max(280/imageDims.width, 280/imageDims.height)}px`, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) rotate(${rotation}deg) scale(${zoom})`, transformOrigin: 'center center', maxWidth: 'none', pointerEvents: 'none' }} draggable={false} />
              <div className="absolute inset-0 border-2 border-white/20 rounded-full pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"></div>
            </div>
            
            <div className="w-full space-y-5 mb-8">
              <div className="flex items-center gap-3"><ZoomIn className="w-5 h-5 text-amber-400/70" /><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full accent-amber-400 h-2 bg-[#1a3059] rounded-lg appearance-none" /></div>
              <div className="flex items-center gap-3"><RotateCw className="w-5 h-5 text-amber-400/70" /><input type="range" min="-180" max="180" step="1" value={rotation} onChange={(e) => setRotation(parseFloat(e.target.value))} className="w-full accent-amber-400 h-2 bg-[#1a3059] rounded-lg appearance-none" /></div>
            </div>
            <div className="flex w-full gap-3">
              <button onClick={() => setCropModalOpen(false)} className="flex-1 py-3 px-4 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold flex justify-center items-center gap-2"><X className="w-5 h-5" /> Annulla</button>
              <button onClick={confirmCrop} className="flex-1 py-3 px-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 text-white font-bold flex justify-center items-center gap-2"><Check className="w-5 h-5" /> Conferma</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom Moneta */}
      {selectedCoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071022]/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedCoin(null)}>
          <div className="relative flex flex-col items-center max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button className="absolute -top-12 right-0 p-2 text-amber-100 hover:text-amber-400 bg-white/10 rounded-full" onClick={() => setSelectedCoin(null)}><X className="w-6 h-6" /></button>
            <div className={`w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full p-2 shadow-[0_0_40px_rgba(251,191,36,0.3)] ${!selectedCoin.acquired ? 'bg-gray-600' : 'bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600'}`}>
              <div className="w-full h-full rounded-full bg-[#030712] overflow-hidden flex items-center justify-center border-4 border-[#1a3059]">
                {selectedCoin.image ? (
                  <img src={selectedCoin.image} alt={selectedCoin.name} className={`w-full h-full object-cover ${!selectedCoin.acquired ? 'grayscale sepia-[.3]' : ''}`} />
                ) : (
                  <Castle className="w-24 h-24 text-amber-500/30" />
                )}
              </div>
            </div>
            <div className="mt-8 text-center bg-[#0f274d]/80 border border-[#1d3d6e] px-8 py-5 rounded-3xl shadow-xl w-full">
              <h3 className="text-3xl font-serif text-amber-400 mb-3">{selectedCoin.name}</h3>
              <p className="text-blue-200/70 text-sm mb-2">{!selectedCoin.acquired && "(Nella Lista dei Desideri)"}</p>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .inner-shadow { box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); }
      `}} />
    </div>
  );
}
