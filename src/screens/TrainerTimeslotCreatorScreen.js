import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { auth, db } from "../services/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  doc,
} from "firebase/firestore";

function pad2(n) {
    return String(n).padStart(2, '0');
}

function formatDateYYYYMMDD(d) {
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    return `${y}-${m}-${day}`;
}

function parseHHMM(str) {
    if (!str || typeof str !== 'string') return null;
    const m = str.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    if (hh < 0 || hh > 23) return null;
    if (mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
}

function minutesToHHMM(mins) {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
}

export default function TrainerTimeslotCreatorScreen({ navigation }) {
    const userId = auth.currentUser?.uid;

    const days = useMemo(() => {
        const now = new Date();
        const arr = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() + i);
            arr.push(d);
        }
        return arr;
    }, []);

    const [selectedDay, setSelectedDay] = useState(days[0]);
    const selectedDateStr = useMemo(() => formatDateYYYYMMDD(selectedDay), [selectedDay]);

    const [trainerId, setTrainerId] = useState(null);
    const [gymId, setGymId] = useState(null);
    const [loadingTrainer, setLoadingTrainer] = useState(true);

    const [startStr, setStartStr] = useState("12:00");
    const [endStr, setEndStr] = useState("18:00");
    const [durationMin, setDurationMin] = useState("60");

    const [loadingExisting, setLoadingExisting] = useState(true);
    const [existingSlots, setExistingSlots] = useState([]);

    useEffect(() => {
        const loadTrainer = async () => {
            if (!userId) return;
            try {
                setLoadingTrainer(true);
                const qT = query(collection(db, 'trainers'), where('userId', '==', userId));
                const snapT = await getDocs(qT);

                if (snapT.empty) {
                    setTrainerId(null);
                    Alert.alert("Klaida", "Nerastas trenerio profilis (trainers.userId).");
                    return;
                }

                const tDoc = snapT.docs[0];
                setTrainerId(tDoc.id);

                const data = tDoc.data();
                setGymId(data?.gymId ?? null);
            }   catch (e) {
                console.log("LOAD TRAINER ERROR:", e);
                Alert.alert("Klaida", "Nepavyko užkrauti trenerio profilio.");
            }   finally {
                setLoadingTrainer(false);
            }
        };

        loadTrainer();
    }, [userId]);

    const loadExisting = async () => {
        if (!trainerId || !selectedDateStr) return;
        try {
            setLoadingExisting(true);
            const qS = query(
                collection(db, 'timeslots'),
                where('trainerId', '==', trainerId),
                where('date', '==', selectedDateStr),
                orderBy('order', 'asc')
            );

            const snap = await getDocs(qS);
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setExistingSlots(list);
        }   catch (e) {
            console.log("LOAD EXISTING SLOTS ERROR:", e);
            Alert.alert("Klaida", "Nepavyko užkrauti laikų. Gali reikėti Firestore index.");
        }   finally {
            setLoadingExisting(false);
        }
    };

    useEffect(() => {
        loadExisting();
    }, [trainerId, selectedDateStr]);

    const onGenerate = async () => {
        if (!trainerId) return;

        const startMin = parseHHMM(startStr);
        const endMin = parseHHMM(endStr);
        const dur = Number(durationMin);

        if (startMin == null || endMin == null) {
            Alert.alert("Klaida", "Laikas turi būti HH:MM formatu (pvz. 18:00).");
            return;
        }
        if (!Number.isFinite(dur) || dur <= 0) {
            Alert.alert("Klaida", "Trukmė turi būti teigiamas skaičius (minutėmis).");
            return;
        }
        if (endMin <= startMin) {
            Alert.alert("Klaida", "Pabaiga turi būti vėliau nei pradžia.");
            return;
        }
        if ((endMin - startMin) < dur) {
            Alert.alert("Klaida", "Intervalas per trumpas pagal trukmę.");
            return;
        }

        const existingOrders = new Set(existingSlots.map((s) => s.order));

        const newSlots = [];
        for (let t = startMin; t + dur <= endMin; t+= dur) {
            if (existingOrders.has(t)) continue;
            newSlots.push({
                date: selectedDateStr,
                trainerId,
                start: minutesToHHMM(t),
                end: minutesToHHMM(t + dur),
                order: t,
                status: 'free',
                createdAt: serverTimestamp(),
            });
        }

        if (newSlots.length === 0) {
            Alert.alert("Nieko naujo", "Visi šio intervalo laikai jau sukurti.");
            return;
        }

        try {
            const batch = writeBatch(db);
            const col = collection(db, 'timeslots');

            newSlots.forEach((slot) => {
                const ref = doc(col);
                batch.set(ref, slot);
            });

            await batch.commit();

            Alert.alert("Sukurta", `Sukurta laikų: ${newSlots.length}`);
            await loadExisting();
        }   catch (e) {
            console.log("GENERATE SLOTS ERROR:", e);
            Alert.alert("Klaida", "Nepavyko sukurti laikų.");
        }   
    };

    if (loadingTrainer) {
        return (
            <View style={[styles.screen, { paddingTop: 24 }]}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.headerRow}>
                <Pressable 
                    style={styles.outlineBtn}
                    onPress={() => navigation.goBack()}>
                    <Text style={styles.outlineBtnText}>← Atgal</Text>
                </Pressable>
                <Text style={styles.title}>Sukurti laikus</Text>
                <View style={{ width: 60}} />
            </View>

            <Text style={styles.label}>Pasirink datą (7 d.)</Text>
            <View style={styles.daysRow}>
                {days.map((d) => {
                    const ds = formatDateYYYYMMDD(d);
                    const active = ds === selectedDateStr;
                    return (
                        <Pressable
                            key={ds}
                            style={[styles.dayBtnText, active && styles.dayBtnTextActive]}
                            onPress={() => setSelectedDay(d)}
                        >
                            <Text style={[styles.dayBtnText, active && styles.dayBtnTextActive]}>
                                {ds.slice(5)}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <Text style={styles.label}>Nustatymai</Text>
            <View style={styles.row}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Pradžia (HH:MM)</Text>
                    <TextInput value={startStr} onChangeText={setStartStr} style={styles.input} />
                </View>
                <View style={{ width: 90 }}>
                    <Text style={styles.inputLabel}>Trukmė</Text>
                    <TextInput
                        value={durationMin}
                        onChangeText={setDurationMin}
                        style={styles.input}
                        keyboardType='numeric'
                    />
                </View>
            </View>

            <Pressable style={styles.primaryBtn} onPress={onGenerate}>
                <Text style={styles.primaryBtnText}>Sukurti laikus</Text>
            </Pressable>

            <View style={styles.sectionHeader}>
                <Text style={styles.label}>Esami laikai</Text>
                <Pressable 
                    style={styles.outlineBtn}
                    onPress={loadExisting}>
                    <Text style={styles.outlineBtnText}>Atnaujinti</Text>
                </Pressable>
            </View>

            {loadingExisting ? (
                <View style={{ paddingTop: 14}}>
                    <ActivityIndicator />
                </View>
            )   : (
                <FlatList
                    data={existingSlots}
                    keyExtractor={(i) => i.id}
                    ListEmptyComponent={<Text style={styles.empty}>Laikų nėra.</Text>}
                    renderItem={({ item }) => (
                        <View style={styles.slotRow}>
                            <Text style={styles.slotTime}>
                                {item.start} - {item.end}
                            </Text>
                            <Text style={styles.slotMeta}>{item.status}</Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 12 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 30 },
    outlineBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#d1d5db",
        backgroundColor: "#fff",
    },
    outlineBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#111827",
    },
    title: { fontSize: 16, fontWeight: "900", color: "#111827" },
    label: { marginTop: 14, marginBottom: 8, fontWeight: "900", color: "#111827" },
    daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: 'center' },
    dayBtn: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: "#fff",
    },
    dayBtnActive: { backgroundColor: "#111827" },
    dayBtnText: { fontWeight: "800", color: "#111827" },
    dayBtnTextActive: { color: "#fff" },
    row: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
    inputLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
    input: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontWeight: "800",
    },
    primaryBtn: {
        marginTop: 14,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: 'center',
        backgroundColor: "#000000ff",
    },
    primaryBtnText: { color: "#ffffffff", fontWeight: "700", fontSize: 14 },
    sectionHeader: { 
        flexDirection: "row", 
        justifyContent: "space-between",
        alignItems: 'center',
        marginBottom: 8,
        paddingTop: 15
    },
    refresh: { fontWeight: "900", color: "#111827" },
    slotRow: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    slotTime: { fontWeight: "900", color: "#111827" },
    slotMeta: { color: "#6b7280", fontWeight: "800" },
    empty: { paddingVertical: 14, color: "#6b7280" },
});