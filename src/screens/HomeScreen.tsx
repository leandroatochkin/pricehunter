import { useMemo, useState, useEffect } from "react";
import {
  View, Text, TextInput, FlatList, ActivityIndicator, StyleSheet,
  TouchableOpacity, Pressable, Modal, ScrollView, Alert
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchProduct } from "../api/client";
import HeartbeatLoader from "../components/Loader";
import * as Location from 'expo-location';

/* ---------- Types ---------- */
type Price = {
  store: string;
  product_name: string;
  brand: string;
  price: number;
  url: string;
  promo_text?: string;
};

type CartItem = Price & { quantity: number };

interface Location {
  city: string;
  province: string;
}

interface SavedList {
  id: string;
  name: string;
  items: CartItem[];
  total: number;
  date: string;
}

interface SearchResponse {
  status: "STARTED" | "PROCESSING" | "COMPLETED";
  message?: string;
  results?: Price[];
}

interface ClientLocation {
  latitude: number;
  longitude: number;
}

interface CheckboxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

interface AccordionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/* ---------- Small UI helpers (Your Checkbox/Accordion) ---------- */
function Checkbox({ label, checked, onToggle }: CheckboxProps) {
  return (
    <Pressable onPress={onToggle} style={styles.checkboxRow}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]} />
      <Text>{label}</Text>
    </Pressable>
  );
}

function Accordion({ title, open, onToggle, children }: any) {
  return (
    <View style={styles.accordion}>
      <Pressable onPress={onToggle}>
        <Text style={styles.accordionTitle}>{title} {open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && children}
    </View>
  );
}

/* ---------- Main Screen ---------- */
export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Price[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // --- List & Cart State ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listName, setListName] = useState("");

  // --- Filter State ---
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [sortAsc, setSortAsc] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [brandAccordion, setBrandAccordion] = useState(true);
  const [storeAccordion, setStoreAccordion] = useState(true);
  const [itemAccordion, setItemAccordion] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [savedLists, setSavedLists] = useState<any[]>([]);
  const [location, setLocation] = useState<{city: string, province: string} | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isSearchHistoryOpen, setIsSearchHistoryOpen] = useState(false);
  const MAX_HISTORY = 20;

  async function getClientLocation() {
  let { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  let location = await Location.getCurrentPositionAsync({});
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

// Load history on mount
useEffect(() => {
  loadSearchHistory();
}, []);

const loadSearchHistory = async () => {
  try {
    const saved = await AsyncStorage.getItem('@search_history');
    if (saved) setSearchHistory(JSON.parse(saved));
  } catch (e) { console.error("Error loading history", e); }
};

const saveToHistory = async (term: string) => {
  const trimmedTerm = term.trim();
  if (!trimmedTerm) return;

  // Remove if term already exists (to bring it to top) and limit to 20
  const filtered = searchHistory.filter(h => h.toLowerCase() !== trimmedTerm.toLowerCase());
  const newHistory = [trimmedTerm, ...filtered].slice(0, MAX_HISTORY);
  
  setSearchHistory(newHistory);
  await AsyncStorage.setItem('@search_history', JSON.stringify(newHistory));
};

const deleteHistoryItem = async (term: string) => {
  const updated = searchHistory.filter(h => h !== term);
  setSearchHistory(updated);
  await AsyncStorage.setItem('@search_history', JSON.stringify(updated));
};

const clearAllHistory = async () => {
  setSearchHistory([]);
  await AsyncStorage.removeItem('@search_history');
};

const handleHistorySelect = (term: string) => {
  setQuery(term);
  setIsSearchHistoryOpen(false);
  // We call handleSearch manually here or wrap handleSearch in a useCallback
  // For now, let's just trigger it:
  setTimeout(() => handleSearchWithTerm(term), 100); 
};

// Update your handleSearch to accept an optional term for history clicks
async function handleSearchWithTerm(overrideTerm?: string) {
  const searchTerm = overrideTerm || query;
  if (searchTerm.length < 2) return;
  
  saveToHistory(searchTerm); // Save term to history
  
  const city = location?.city || "MAR_DEL_PLATA"; 
  const province = location?.province || "BUENOS_AIRES";

  setLoading(true); 
  setError(null); 
  setStatusMessage(`Buscando en ${city}...`);
  setData([]); 
  
  await pollSearch(searchTerm, city, province);
  setHasSearched(true);
}

// 1. Get location on Mount or before search
  useEffect(() => {
    (async () => {
      const loc = await getClientLocation();
      if (loc) {
        // Reverse Geocode the coordinates into City/Province
        // You can use Expo's built-in reverseGeocodeAsync
        const [address] = await Location.reverseGeocodeAsync({
          latitude: loc.latitude,
          longitude: loc.longitude,
        });

        if (address) {
          setLocation({
            city: address.city || address.subregion || "Unknown",
            province: address.region || "Unknown"
          });
        }
      }
    })();
  }, []);

  /* ---------- Cart Logic ---------- */
  const addToCart = (product: Price) => {
    setCart(prev => {
      const existing = prev.find(i => i.url === product.url);
      if (existing) {
        return prev.map(i => i.url === product.url ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (url: string) => {
    setCart(prev => prev.filter(i => i.url !== url));
  };

  const groupedCart = useMemo(() => {
    return cart.reduce((acc, item) => {
      if (!acc[item.store]) acc[item.store] = [];
      acc[item.store].push(item);
      return acc;
    }, {} as Record<string, CartItem[]>);
  }, [cart]);

  const totalCartPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const saveListToDevice = async () => {
    if (!listName.trim()) return Alert.alert("Error", "Ponle un nombre a tu lista");
    try {
      const existingData = await AsyncStorage.getItem('@my_lists');
      const prevLists = existingData ? JSON.parse(existingData) : [];
      const newList = { id: Date.now().toString(), name: listName, items: cart, total: totalCartPrice, date: new Date().toLocaleDateString() };
      await AsyncStorage.setItem('@my_lists', JSON.stringify([newList, ...prevLists]));
      Alert.alert("Éxito", "Lista guardada");
      setCart([]); setListName(""); setIsListModalOpen(false);
    } catch (e) { Alert.alert("Error", "Error al guardar"); }
  };

  /* ---------- Polling Search Logic (Restored) ---------- */
 // React Native HomeScreen
async function pollSearch(searchQuery: string, userCity: string, userProvince: string) {
  try {
      // Pass location to the API so the backend can build the specific lock
      const response = await searchProduct(searchQuery, userCity, userProvince);

      if (response.status === "COMPLETED") {
        const rawResults: Price[] = response.results || [];
        
        // Remove duplicates based on URL using typed parameters
        const uniqueResults = rawResults.filter((item: Price, index: number, self: Price[]) =>
          index === self.findIndex((t: Price) => t.url === item.url)
        );

        setData(uniqueResults);
        setLoading(false);
        setStatusMessage(null);
      }
      else if (response.status === "STARTED" || response.status === "PROCESSING") {
        setStatusMessage(response.message || "Buscando mejores precios...");
        setTimeout(() => pollSearch(searchQuery, userCity, userProvince), 4000);
      }
    } catch (err: any) {
    // If we hit a rate limit, don't show a red error, just wait longer
    if (err.message?.includes("Too many requests")) {
      setStatusMessage("Servidor ocupado, reintentando en breve...");
      setTimeout(() => pollSearch(searchQuery, userCity, userProvince), 10000); // Wait 10s if rate limited
    } else {
      setError(err.message || "Error de conexión");
      setLoading(false);
    }
  }
}

  async function handleSearch() {
    if (query.length < 2) return;
    
    // Fallback if location permission was denied or still loading
    const city = location?.city || "MAR_DEL_PLATA"; 
    const province = location?.province || "BUENOS_AIRES";

    setLoading(true); 
    setError(null); 
    setStatusMessage(`Buscando en ${city}...`);
    setData([]); 
    
    // Start polling with location data
    await pollSearch(query, city, province);
    setHasSearched(true);
  }

  /* ---------- Derived Data & Filters (Restored) ---------- */
  const storeFilter = useMemo(() => Array.from(new Set(data.map(d => d.store))), [data]);
  const brandFilter = useMemo(() => Array.from(new Set(data.map(d => d.brand))), [data]);
  const itemsFilter = useMemo(() => Array.from(new Set(data.map(d => d.product_name.split(" ")[0]))), [data]);

  const filtered = useMemo(() => {
    let result = data.filter(p => {
      const brandOk = selectedBrands.length === 0 || selectedBrands.includes(p.brand);
      const storeOk = selectedStores.length === 0 || selectedStores.includes(p.store);
      const itemOk = selectedItems.length === 0 || selectedItems.some(i => p.product_name.toLowerCase().includes(i.toLowerCase()));
      return brandOk && storeOk && itemOk;
    });
    result.sort((a, b) => sortAsc ? a.price - b.price : b.price - a.price);
    return result;
  }, [data, selectedBrands, selectedStores, selectedItems, sortAsc]);

  const cheapestPrice = filtered[0]?.price;

  const loadSavedLists = async () => {
    try {
      const data = await AsyncStorage.getItem('@my_lists');
      if (data) setSavedLists(JSON.parse(data));
      setIsHistoryOpen(true);
    } catch (e) {
      Alert.alert("Error", "No se pudieron cargar las listas");
    }
  };

  const deleteList = async (id: string) => {
    const updated = savedLists.filter(l => l.id !== id);
    setSavedLists(updated);
    await AsyncStorage.setItem('@my_lists', JSON.stringify(updated));
  };

  return (
    <View style={styles.container}>
      {/* Header with History Access */}
      <View style={styles.header}>
        <Text style={styles.title}>SuperMatch</Text>
        <TouchableOpacity onPress={loadSavedLists}>
           <Text style={styles.historyBtn}>📜 Mis Listas</Text>
        </TouchableOpacity>
      </View>
      {/* Search Row */}
        <View style={styles.searchRow}>
          <TouchableOpacity 
            style={styles.historyIconButton} 
            onPress={() => setIsSearchHistoryOpen(true)}
          >
            <Text style={{ fontSize: 20 }}>🕒</Text>
          </TouchableOpacity>

          <TextInput 
            style={styles.input} 
            placeholder="Buscar producto..." 
            value={query} 
            onChangeText={setQuery}
            // Removed the automatic onFocus trigger to keep it manual
          />

          <TouchableOpacity style={styles.button} onPress={() => handleSearchWithTerm()}>
            <Text style={styles.buttonText}>Buscar</Text>
          </TouchableOpacity>
        </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => setFilterOpen(true)}>
          <Text style={styles.controlBtn}>Filtros ({selectedBrands.length + selectedStores.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSortAsc(s => !s)}>
          <Text style={styles.controlBtn}>Precio {sortAsc ? "⬆" : "⬇"}</Text>
        </TouchableOpacity>
      </View>

      {/* Cart Summary Button */}
      {cart.length > 0 && (
        <TouchableOpacity style={styles.cartSummaryBanner} onPress={() => setIsListModalOpen(true)}>
          <Text style={styles.buttonText}>📋 Ver Mi Lista ({cart.length}) - Total: ${totalCartPrice}</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loaderContainer}>
          {/* <ActivityIndicator size="large" color="#000" /> */}
          <HeartbeatLoader />
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Results */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.url}
        ListEmptyComponent={() => (!loading && hasSearched ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No se encontraron productos</Text>
          </View>
        ) : null)}
        renderItem={({ item }) => (
          <View style={[styles.card, item.price === cheapestPrice && styles.cheapest]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.product_name}</Text>
              <Text style={styles.subText}>{item.brand} | {item.store}</Text>
              {item.promo_text && (
                <View style={styles.promoBadge}><Text style={styles.promoText}>{item.promo_text}</Text></View>
              )}
              <Text style={styles.price}>${item.price}</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(item)}>
              <Text style={styles.addBtnText}>+ Añadir</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* --- Filter Modal (Restored) --- */}
      <Modal visible={filterOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Filtros</Text>
            <ScrollView>
              <Accordion title="Marca" open={brandAccordion} onToggle={() => setBrandAccordion(!brandAccordion)}>
                {brandFilter.map(b => (
                  <Checkbox key={b} label={b} checked={selectedBrands.includes(b)} onToggle={() => setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])} />
                ))}
              </Accordion>
              <Accordion title="Tienda" open={storeAccordion} onToggle={() => setStoreAccordion(!storeAccordion)}>
                {storeFilter.map(s => (
                  <Checkbox key={s} label={s} checked={selectedStores.includes(s)} onToggle={() => setSelectedStores(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                ))}
              </Accordion>
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setFilterOpen(false)}>
              <Text style={styles.buttonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- Shopping List Modal --- */}
      {/* --- MODAL: SAVING LIST (Fixed Input) --- */}
      <Modal visible={isListModalOpen} animationType="slide">
        <View style={styles.listModal}>
          <Text style={styles.sheetTitle}>Guardar Lista Actual</Text>
          
          {/* FIXED HEIGHT INPUT: Won't grow or shrink */}
          <View style={styles.fixedInputContainer}>
            <TextInput 
              style={styles.fixedInput} 
              placeholder="Nombre de la lista (ej: Compras Mes)" 
              value={listName}
              onChangeText={setListName}
            />
          </View>

          <ScrollView style={styles.modalScroll}>
            {Object.entries(groupedCart).map(([store, items]) => (
              <View key={store} style={styles.storeGroup}>
                <Text style={styles.storeHeader}>{store}</Text>
                {items.map(item => (
                  <View key={item.url} style={styles.cartItem}>
                    <Text style={{ flex: 1 }}>{item.product_name} x{item.quantity}</Text>
                    <TouchableOpacity onPress={() => removeFromCart(item.url)}>
                      <Text style={{ color: 'red' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.saveBtn} onPress={saveListToDevice}>
            <Text style={styles.buttonText}>Guardar en Memoria</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsListModalOpen(false)}>
            <Text style={styles.closeText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      {/* --- MODAL: HISTORY (Saved Lists) --- */}
      <Modal visible={isHistoryOpen} animationType="slide">
        <View style={styles.listModal}>
          <Text style={styles.sheetTitle}>Historial de Listas</Text>
          <FlatList
            data={savedLists}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.historyCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{item.name}</Text>
                  <Text style={styles.historyMeta}>{item.date} • Total: ${item.total}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteList(item.id)}>
                  <Text style={{ color: 'red' }}>Borrar</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={{ textAlign: 'center' }}>No tienes listas guardadas.</Text>}
          />
          <TouchableOpacity 
            style={styles.closeBtnBlack} 
            onPress={() => setIsHistoryOpen(false)}
          >
            <Text style={styles.buttonText}>Cerrar Historial</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* --- MODAL: SEARCH HISTORY --- */}
      <Modal visible={isSearchHistoryOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.historyModalContent}>
            <View style={styles.historyHeader}>
              <Text style={styles.sheetTitle}>Búsquedas Recientes</Text>
              <TouchableOpacity onPress={clearAllHistory}>
                <Text style={{ color: 'red', fontWeight: 'bold' }}>Borrar todo</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={searchHistory}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <View style={styles.historyItemRow}>
                  <TouchableOpacity 
                    style={{ flex: 1, paddingVertical: 12 }} 
                    onPress={() => handleHistorySelect(item)}
                  >
                    <Text style={styles.historyText}>🔍 {item}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.deleteItemBtn} 
                    onPress={() => deleteHistoryItem(item)}
                  >
                    <Text style={{ color: '#ccc', fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No hay búsquedas recientes</Text>
              }
            />

            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => setIsSearchHistoryOpen(false)}
            >
              <Text style={styles.buttonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 50, backgroundColor: '#fff' },
  //searchRow: { flexDirection: "row", marginBottom: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 8 },
  button: { marginLeft: 8, backgroundColor: "#000", paddingHorizontal: 16, justifyContent: "center", borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "bold" },
  controls: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  controlBtn: { fontWeight: "bold", fontSize: 14 },
  card: { padding: 15, borderBottomWidth: 1, borderColor: "#eee", flexDirection: 'row', alignItems: 'center' },
  cheapest: { backgroundColor: "#eaffea" },
  name: { fontWeight: "bold", fontSize: 14 },
  subText: { color: '#666', fontSize: 12 },
  price: { fontSize: 18, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#000', padding: 10, borderRadius: 6 },
  addBtnText: { color: '#fff', fontSize: 12 },
  cartSummaryBanner: { backgroundColor: '#28a745', padding: 15, borderRadius: 10, marginBottom: 15, alignItems: 'center' },
  loaderContainer: { alignItems: 'center', marginVertical: 20 },
  statusMessage: { color: '#888', fontStyle: 'italic', marginTop: 5 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" },
  bottomSheet: { backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  listModal: { flex: 1, padding: 20, paddingTop: 60 },
  sheetTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  storeGroup: { backgroundColor: '#f8f8f8', padding: 10, borderRadius: 8, marginBottom: 10 },
  storeHeader: { fontWeight: 'bold', borderBottomWidth: 1, borderColor: '#ddd', marginBottom: 5 },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalText: { fontSize: 20, fontWeight: 'bold', textAlign: 'right', marginBottom: 20 },
  saveBtn: { backgroundColor: '#000', padding: 15, borderRadius: 8, alignItems: 'center' },
  closeBtn: { backgroundColor: '#000', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  closeText: { textAlign: 'center', marginTop: 20, color: '#999' },
  promoBadge: { backgroundColor: "#fff0f0", paddingHorizontal: 6, borderRadius: 4, marginVertical: 2, alignSelf: 'flex-start' },
  promoText: { color: "#d32f2f", fontSize: 10, fontWeight: "bold" },
  accordion: { marginBottom: 10 },
  accordionTitle: { fontWeight: "bold", paddingVertical: 5 },
  checkboxRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  checkbox: { width: 18, height: 18, borderWidth: 1, marginRight: 10 },
  checkboxChecked: { backgroundColor: "green" },
  error: { color: 'red', textAlign: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#999' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  historyBtn: { color: '#007AFF', fontWeight: 'bold' },

  // THE FIXED INPUT FIX
  fixedInputContainer: {
    height: 50, // Static height
    marginBottom: 10,
  },
  fixedInput: {
    height: 45,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },

  modalScroll: {
    flex: 1, // Takes up remaining space without pushing the input
    marginVertical: 10,
  },

  // History Card Styles
  historyCard: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee'
  },
  historyName: { fontWeight: 'bold', fontSize: 16 },
  historyMeta: { color: '#666', fontSize: 12 },
  closeBtnBlack: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  historyModalContent: {
    backgroundColor: "#fff",
    margin: 20,
    borderRadius: 20,
    padding: 20,
    maxHeight: '60%',
    width: '90%',
    alignSelf: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyText: {
    fontSize: 16,
    color: '#333',
  },
  deleteItemBtn: {
    padding: 10,
  },
  searchRow: { 
    flexDirection: "row", 
    marginBottom: 10, 
    alignItems: 'center' // Ensures button and input line up
  },
  historyIconButton: {
    padding: 10,
    marginRight: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
});