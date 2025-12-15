import React, { use, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { auth, db } from "../services/firebase";

export default function HomeScreen({ navigation }) {
    const userEmail = auth.currentUser?.email ?? '';

    const [gyms, setGyms] = useState([]);
    const [loadingGyms, setLoadingGyms] = useState(true);

    const [expandedGymId, setExpandedGymId] = useState(null);
    const [trainersByGym, setTrainersByGym] = useState({});
    const [loadingTrainersGymId, setLoadingTrainersGymId] = useState(null);

    useEffect(() => {
        const loadGyms = async () => {
            try {
                setLoadingGyms(true);
                const q = query(
                    collection(db, "gyms"),
                    orderBy("order", "asc")
                );
                const snap = await getDocs(q);
                const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                setGyms(list);
            }   catch (e) {
                console.log("LOAD GYMS ERROR: ", e);
            }   finally {
                setLoadingGyms(false);
            }
        };

        loadGyms();
    }, []);

    const toggleGym = async (gymId) => {
        if (expandedGymId === gymId) {
            setExpandedGymId(null);
            return;
        }

        setExpandedGymId(gymId);

        if (trainersByGym[gymId]) return;

        try {
            setLoadingTrainersGymId(gymId);
            const q = query(
                collection(db, "trainers"),
                where("gymId", "==", gymId),
                orderBy("order", "asc")
            );
            const snap = await getDocs(q);
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setTrainersByGym((prev) => ({ ...prev, [gymId]: list }));
        }   catch (e) {
            console.log("LOAD TRAINERS ERROR: ", e);
        }   finally {
            setLoadingTrainersGymId(null);
        }
    };

    const onLogout = async () => {
        await signOut(auth);
        navigation.replace("Login");
    };

    const renderTrainerRow = (trainer, gymId) => {
        return (
            <View key={trainer.id} style={styles.trainerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.trainerName}>{trainer.vardas || "Treneris"}</Text>
                    <Text style={styles.trainerSpec}>{trainer.specializacija || ""}</Text>
                </View>

                <Text style={styles.price}>
                    {typeof trainer.kaina === "number" ? `${trainer.kaina}€` : "—"}
                </Text>

                <Pressable
                    style={styles.reserveBtn}
                    onPress={() =>
                        navigation.navigate("Booking", { trainerId: trainer.id, gymId })
                    }
                >
                    <Text style={styles.reserveBtnText}>Rezervuoti</Text>
                </Pressable>
            </View>
            
        );
    };

    const renderGymCard = ({ item }) => {
        const isExpanded = expandedGymId === item.id;
        const trainers = trainersByGym[item.id] || [];
        const isLoadingTrainers = loadingTrainersGymId === item.id;

        return (
            <View style={styles.gymCard}>
                <Pressable onPress={() =>
                    toggleGym(item.id)}
                    style={styles.gymHeader}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={styles.gymTitle}>
                            {item.pavadinimas || "Sporto salė"}
                        </Text>
                        <Text style={styles.gymMeta}>
                            Adresas: {item.adresas || ''}
                        </Text>
                    </View>

                    <Text style={styles.chevron}>{isExpanded ? '+' : '-'}</Text>
                </Pressable>

                {isExpanded && (
                    <View style={styles.trainersBox}>
                        {isLoadingTrainers ? (
                            <View style={{ paddingVertical: 10 }}>
                                <ActivityIndicator />
                            </View>
                        )   : trainers.length === 0 ? (
                            <Text style={styles.emptyText}>Šioje sporto salėje trenerių nėra.</Text>
                        )   : (
                            trainers.map((t) => renderTrainerRow(t, item.id))
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.screen}>
            <View style={styles.topBar}>
                <Text numberOfLines={1} style={styles.userEmail}>
                    {userEmail}
                </Text>

                <View style={styles.topActions}>
                    <Pressable
                        style={styles.topBtn}
                        onPress={() =>
                            navigation.navigate("Reservations")
                        }
                    >
                        <Text style={styles.topBtnText}>Rezervacijos</Text>
                    </Pressable>

                    <Pressable 
                        style={styles.topBtn}
                        onPress={onLogout}
                    >
                        <Text style={styles.topBtnText}>Atsijungti</Text>    
                    </Pressable> 
                </View>
            </View>

            <Text style={styles.pageTitle}>Sporto salės</Text>

            {loadingGyms ? (
                <View style={{ paddingTop: 30 }}>
                    <ActivityIndicator />
                </View>
            )   : (
                <FlatList
                    data={gyms}
                    keyExtractor={(item) => item.id}
                    renderItem={renderGymCard}
                    contentContainerStyle={{ paddingBottom: 24 }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 16 },
  topBar: {
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  userEmail: { flex: 1, color: "#6b7280", fontSize: 12 },
  topActions: { flexDirection: "row", gap: 8 },
  topBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  topBtnText: { fontSize: 12, color: "#111827", fontWeight: "600" },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 12,
    color: "#111827",
  },
  gymCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  gymHeader: {
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  gymTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  gymMeta: { marginTop: 4, fontSize: 12, color: "#6b7280" },
  chevron: { fontSize: 18, color: "#6b7280", paddingLeft: 8 },
  trainersBox: { paddingHorizontal: 12, paddingBottom: 12 },
  trainerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  trainerName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  trainerSpec: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  price: { width: 50, textAlign: "right", fontWeight: "700", color: "#111827" },
  reserveBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  reserveBtnText: { fontSize: 12, fontWeight: "700", color: "#111827" },
  emptyText: { paddingVertical: 10, color: "#6b7280", fontSize: 12 },
});