import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { TIMESLOT_STATUS_LT } from "../constants/statuses";
import AnimatedScreen from "../components/AnimatedScreen";
import colors from "../theme/colors";

function formatDateYYYYMMDD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function formatDateLabel(d) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const weekday = ["Sek", "Pir", "Ant", "Tre", "Ket", "Pen", "Šeš"][d.getDay()];
    return `${mm}-${dd} (${weekday})`;
}

export default function BookingScreen({ route, navigation }) {
    const { trainerId, gymId } = route.params || {};
    const userId = auth.currentUser?.uid;

    const days = useMemo(() => {
        const arr = [];
        const now = new Date();
        for ( let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() + i);
            arr.push(d);
        }
        return arr;
    }, []);

    const [selectedDay, setSelectedDay] = useState(days[0]);

    useEffect(() => {
        if (!selectedDay && days.length > 0) {
            setSelectedDay(days[0]);
        }
    }, [days, selectedDay]);

    const selectedDateStr = useMemo(() => {
        if (!selectedDay) return null;
        return formatDateYYYYMMDD(selectedDay);
    }, [selectedDay]);

    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(true);
    const [bookingSlotId, setBookingSlotId] = useState(null);

    useEffect(() => {
        (async () => {
            if (!trainerId) return;
            const changed = await expirePastFreeSlots(trainerId);
            if (changed) console.log("Expired slots: ", changed);
        })

        const loadSlots = async () => {

            if (!trainerId || !selectedDateStr) return;

            try {
                setLoadingSlots(true);

                const q = query(
                    collection(db, "timeslots"),
                    where("trainerId", "==", trainerId),
                    where("date", "==", selectedDateStr),
                    orderBy("order", "asc")
                );

                const snap = await getDocs(q);

                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setSlots(list);
            }   catch (e) {
                console.log("Klaida", "Nepavyko užkrauti laikų. Patikrink Firebase index / fields.");
                setSlots([]);
            } finally {
                setLoadingSlots(false);
            }
        };

        loadSlots();
    }, [trainerId, selectedDateStr]);

    const onBook = async (slot) => {
        if (!userId) {
            Alert.alert("Klaida", "Nėra prisijungusio naudotojo.");
            return;
        }
        if (slot.status !== 'free') return;

        try {
            setBookingSlotId(slot.id);

            await addDoc(collection(db, "reservations"), {
                userId,
                trainerId,
                gymId: gymId ?? null,
                slotId: slot.id,

                date: slot.date,
                start: slot.start,
                end: slot.end,

                status: 'pending',
                createdAt: serverTimestamp(),
            });

            await updateDoc(doc(db, "timeslots", slot.id) , {
                status: 'booked',
            });

            setSlots(prev => 
                prev.map(s => (s.id === slot.id ? { ...s, status: "booked" } : s))
            );

            Alert.alert("Pavyko", "Rezervacija sukurta (laukiama patvirtinimo).");
        }   catch (e) {
            console.log("BOOK ERROR: ", e);
            Alert.alert("Klaida", "Nepavyko sukurti rezervacijos.");
        }   finally {
            setBookingSlotId(null);
        }
    };

    const visibleSlots = slots.filter((s) => s.status !== "expired");

    return (
        <AnimatedScreen style={styles.screen}>
            <View style={styles.headerRow}>
                <Pressable 
                    style={styles.outlineBtn}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.outlineBtnText}>← Atgal</Text>
                </Pressable>
                <Text style={styles.title}>Rezervacija</Text>
                <View style={{ width: 60 }} />
            </View>

            <Text style={styles.sectionTitle}>Pasirink datą (tik 7 d.)</Text>
            <View style={styles.daysRow}>
                {days.map((d) => {
                    const active = formatDateYYYYMMDD(d) === selectedDateStr;
                    return (
                        <Pressable
                            key={formatDateYYYYMMDD(d)}
                            onPress={() => setSelectedDay(d)}
                            style={[styles.dayChip, active && styles.dayChipActive]}
                        >
                            <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                                {formatDateLabel(d)}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <Text style={styles.sectionTitle}>Laisvi laikai</Text>

            {loadingSlots ? (
                <View style={{ paddingTop: 20 }}>
                    <ActivityIndicator color={colors.accent} />
                </View>
            )   : (
                <FlatList
                    data={visibleSlots}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    ListEmptyComponent={
                        <Text style={styles.empty}>Šiai dienai laisvų laikų nėra.</Text>
                    }
                    renderItem={({ item }) => {
                        const disabled = item.status !== 'free' || bookingSlotId === item.id;
                        return (
                            <View style={styles.slotRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.slotTime}>
                                        {item.start} - {item.end}
                                    </Text>
                                    <Text style={styles.slotMeta}>
                                        Statusas: {TIMESLOT_STATUS_LT[item.status] ?? item.status}
                                    </Text>
                                </View>

                                <Pressable
                                    disabled={disabled}
                                    onPress={() => onBook(item)}
                                    style={[styles.bookBtn, disabled && styles.bookBtnDisabled]}
                                >
                                    <Text style={styles.bookBtnText}>
                                        {bookingSlotId === item.id ? "Kuriama..." : "Rezervuoti"}
                                    </Text>
                                </Pressable>
                            </View>
                        );
                    }}
                />
            )}
        </AnimatedScreen>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 30 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 15 },
    outlineBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
    },
    outlineBtnText: {
        fontSize: 12,
        fontWeight: "800",
        color: colors.accent,
    },
    title: { fontSize: 16, fontWeight: "800", color: colors.text },
    sectionTitle: { marginTop: 14, marginBottom: 8, fontWeight: "800", color: colors.text },
    daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    dayChip: {
        borderWidth: 1, 
        borderColor: colors.border, 
        borderRadius: 999,
        paddingHorizontal: 10, 
        paddingVertical: 6, 
        backgroundColor: colors.card,
    },
    dayChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    dayChipText: { fontSize: 12, color: colors.text, fontWeight: "700" },
    dayChipTextActive: { color: "#0b0c10" },
    slotRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    slotTime: { fontWeight: "800", color: colors.text },
    slotMeta: { marginTop: 4, fontSize: 12, color: colors.muted },
    bookBtn: {
        borderWidth: 1, 
        borderColor: colors.accent, 
        borderRadius: 10,
        paddingHorizontal: 12, 
        paddingVertical: 8, 
        backgroundColor: colors.accent,
    },
    bookBtnDisabled: { opacity: 0.6 },
    bookBtnText: { fontSize: 12, fontWeight: "800", color: "#0b0c10" },
    empty: { paddingVertical: 12, color: colors.muted },
});
