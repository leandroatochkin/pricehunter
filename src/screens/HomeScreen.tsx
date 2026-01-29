import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
} from "react-native";
import { searchProduct } from "../api/client";

type Price = {
  store: string;
  product_name: string;
  brand: string;
  price: number;
  url: string;
};

/* ---------- Small UI helpers ---------- */

function Checkbox({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.checkboxRow}>
      <View
        style={[
          styles.checkbox,
          checked && styles.checkboxChecked,
        ]}
      />
      <Text>{label}</Text>
    </Pressable>
  );
}

function Accordion({
  title,
  open,
  onToggle,
  children,
}: any) {
  return (
    <View style={styles.accordion}>
      <Pressable onPress={onToggle}>
        <Text style={styles.accordionTitle}>
          {title} {open ? "▲" : "▼"}
        </Text>
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

  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [sortAsc, setSortAsc] = useState(true);

  const [filterOpen, setFilterOpen] = useState(false);
  const [brandAccordion, setBrandAccordion] = useState(true);
  const [storeAccordion, setStoreAccordion] = useState(true);
  const [itemAccordion, setItemAccordion] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null); // New state for UX
// Helper function to handle the polling logic
  async function pollSearch(searchQuery: string) {
    try {
      const response = await searchProduct(searchQuery);

      if (response.status === "COMPLETED") {
        setData(response.results || []);
        setLoading(false);
        setStatusMessage(null);
      } 
      else if (response.status === "STARTED" || response.status === "PROCESSING") {
        // Update message for the user
        setStatusMessage(response.message || "Buscando mejores precios...");
        
        // Wait 3 seconds and poll again
        setTimeout(() => pollSearch(searchQuery), 3000);
      } 
      else if (response.status === "EMPTY") {
        setData([]);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Error de conexión");
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (query.length < 2) return;

    setLoading(true);
    setError(null);
    setStatusMessage("Iniciando búsqueda...");
    setData([]); // Clear old results while searching
    
    // Reset filters for new search
    setSelectedBrands([]);
    setSelectedStores([]);
    setSelectedItems([]);

    await pollSearch(query);
  }

  /* ---------- Derived data ---------- */

  const storeFilter = useMemo(
    () => Array.from(new Set(data.map(d => d.store))),
    [data]
  );

  const brandFilter = useMemo(
    () => Array.from(new Set(data.map(d => d.brand))),
    [data]
  );

  const items = useMemo(
    () =>
      Array.from(
        new Set(data.map(d => d.product_name.split(" ")[0]))
      ),
    [data]
  );

  const filtered = useMemo(() => {
    let result = data.filter(p => {
      const brandOk =
        selectedBrands.length === 0 ||
        selectedBrands.includes(p.store);

      const itemOk =
        selectedItems.length === 0 ||
        selectedItems.some(i =>
          p.product_name
            .toLowerCase()
            .includes(i.toLowerCase())
        );

      return brandOk && itemOk;
    });

    result.sort((a, b) =>
      sortAsc ? a.price - b.price : b.price - a.price
    );

    return result;
  }, [data, selectedBrands, selectedItems, sortAsc]);

  const cheapestPrice = filtered[0]?.price;

  /* ---------- UI ---------- */

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Buscar producto..."
          value={query}
          onChangeText={setQuery}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={handleSearch}
        >
          <Text style={styles.buttonText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
        >
          <Text style={styles.controlBtn}>Filtros</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSortAsc(s => !s)}
        >
          <Text style={styles.controlBtn}>
            Precio {sortAsc ? "⬆" : "⬇"}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Results */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.url}
        renderItem={({ item }) => {
          const isCheapest =
            item.price === cheapestPrice;

          return (
            <View
              style={[
                styles.card,
                isCheapest && styles.cheapest,
              ]}
            >
              <Text style={styles.name}>
                {item.product_name}
              </Text>
              <Text>{item.brand}</Text>
              <Text>{item.store}</Text>
              <Text style={styles.price}>
                ${item.price}
              </Text>
              {isCheapest && (
                <Text style={styles.cheapestBadge}>
                  🟢 Más barato
                </Text>
              )}
            </View>
          );
        }}
      />

      {/* ---------- Bottom Sheet Filters ---------- */}
      <Modal
        visible={filterOpen}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>
              Filtros
            </Text>

            <Accordion
              title="Marca"
              open={brandAccordion}
              onToggle={() =>
                setBrandAccordion(o => !o)
              }
            >
              {brandFilter.map(b => (
                <Checkbox
                  key={b}
                  label={b}
                  checked={selectedBrands.includes(b)}
                  onToggle={() =>
                    setSelectedBrands(prev =>
                      prev.includes(b)
                        ? prev.filter(x => x !== b)
                        : [...prev, b]
                    )
                  }
                />
              ))}
            </Accordion>

            <Accordion
              title="Tienda"
              open={storeAccordion}
              onToggle={() =>
                setStoreAccordion(o => !o)
              }
            >
              {storeFilter.map(s => (
                <Checkbox
                  key={s}
                  label={s}
                  checked={selectedStores.includes(s)}
                  onToggle={() =>
                    setSelectedStores(prev =>
                      prev.includes(s)
                        ? prev.filter(x => x !== s)
                        : [...prev, s]
                    )
                  }
                />
              ))}
            </Accordion>

            <Accordion
              title="Producto"
              open={itemAccordion}
              onToggle={() =>
                setItemAccordion(o => !o)
              }
            >
              {items.map(i => (
                <Checkbox
                  key={i}
                  label={i}
                  checked={selectedItems.includes(i)}
                  onToggle={() =>
                    setSelectedItems(prev =>
                      prev.includes(i)
                        ? prev.filter(x => x !== i)
                        : [...prev, i]
                    )
                  }
                />
              ))}
            </Accordion>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setFilterOpen(false)}
            >
              <Text style={styles.buttonText}>
                Aplicar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },

  searchRow: {
    flexDirection: "row",
    marginBottom: 10,
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 4,
  },

  button: {
    marginLeft: 8,
    backgroundColor: "#000",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 4,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },

  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  controlBtn: {
    fontWeight: "bold",
  },

  card: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  cheapest: {
    backgroundColor: "#eaffea",
  },

  cheapestBadge: {
    color: "green",
    fontWeight: "bold",
  },

  name: { fontWeight: "bold" },
  price: { fontSize: 18 },

  error: { color: "red", marginVertical: 8 },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  bottomSheet: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
  },

  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },

  accordion: {
    marginBottom: 12,
  },

  accordionTitle: {
    fontWeight: "bold",
    marginBottom: 6,
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },

  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: "#333",
    marginRight: 8,
  },

  checkboxChecked: {
    backgroundColor: "#4CAF50",
  },

  closeBtn: {
    backgroundColor: "#000",
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 12,
  },

  loaderContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  
  statusMessage: {
    marginTop: 10,
    color: '#666',
    fontStyle: 'italic',
  },
});
