import { useMemo, useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { auth, db } from "../services/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import colors from "../theme/colors";
import AnimatedScreen from "../components/AnimatedScreen";
import { parseCheckinQrValue } from "../utils/qr";


export default function QrScannerScreen({ navigation }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [processing, setProcessing] = useState(false);
    const scanLockRef = useRef(false);

    const barcodeScannerSettings = useMemo(
        () => ({
            barcodeTypes: ["qr"],
        }),
        []
    );

    const handleBarcodeScanned = async ({ data }) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    setScanned(true);

    const parsed = parseCheckinQrValue(data);
        if (!parsed) {
        Alert.alert("Netinkamas QR", "Šitas QR nėra CoachBooking check-in kodas.", [
            { text: "OK", onPress: () => { scanLockRef.current = false; } },
        ]);
        setScanned(false);
        return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
        Alert.alert("Klaida", "Nėra prisijungusio naudotojo.");
        setScanned(false);
        return;
    }

    try {
        setProcessing(true);

        const ref = doc(db, "reservations", parsed.reservationId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
        Alert.alert("Klaida", "Rezervacija nerasta.");
        return;
        }

        const r = snap.data();

        const toDateObj = (val) => {
            if (val?.toDate) return val.toDate();
            if (val instanceof Date) return val;

            if (typeof val === "string") {
                const normalized = val.replaceAll("/", "-");
                const d = new Date(normalized);
                return Number.isNaN(d.getDate()) ? null : d;
            }
            return null;
        };

        const buildLocalDateTime = (dateVal, timeStr) => {
            const d = toDateObj(dateVal);
            if (!d || typeof timeStr !== "string") return null;

            const [hh, mm] = timeStr.split(":").map((x) => parseInt(x, 10));
            if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);
        };

        const startDt = buildLocalDateTime(r.date, r.start);
        const endDt = buildLocalDateTime(r.date, r.end);
        const now = new Date();

        if (!startDt || !endDt) {
            Alert.alert("Klaida", "Nepavyko nustatyti rezervacijos laiko (date/start/end).");
            return;
        }

        if (now < startDt) {
            Alert.alert("Per anksti", "Check-in galima atlikti tik prasidėjus rezervacijai.");
            return;
        }

        if (now > endDt) {
            Alert.alert("Per vėlu", "Rezervacijos laikas praėjo — check-in nebegalimas.", [
                { text: "OK", onPress: () => { scanLockRef.current = false; } },
            ]);
            return;
        }

        if (r.userId !== userId) {
        Alert.alert("Negalima", "Ši rezervacija nepriklauso jums.");
        return;
        }

        if (r.status !== "confirmed" && r.status !== "checkedIn") {
        Alert.alert("Negalima", `Check-in galima tik kai statusas "Patvirtinta". Dabar: ${r.status}`);
        return;
        }

        if (r.status === "checkedIn") {
        Alert.alert("OK", "Check-in jau atliktas ✅");
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate("Reservations");
        }
        return;
        }

        await updateDoc(ref, {
        status: "checkedIn",
        checkedInAt: serverTimestamp(),
        });

        Alert.alert("Pavyko", "Check-in atliktas ✅");
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate("Reservations");
        }
    } catch (e) {
        console.log("CHECKIN ERROR:", e);
        Alert.alert("Klaida", "Nepavyko atlikti check-in.");
      } finally {
        setProcessing(false);
        setScanned(false);
      }
    };

    if (!permission) {
        return (
            <AnimatedScreen style={styles.screen}>
                <View style={{ paddingTop: 24 }}>
                    <ActivityIndicator color={colors.accent} />
                </View>
            </AnimatedScreen>
        );
    }

    if (!permission.granted) {
        return (
            <AnimatedScreen style={styles.screen}>
                <Text style={styles.title}>Reikia kameros leidimo</Text>
                <Text style={styles.hint}>
                    Kad nuskenuotum QR, programėlei reikia prieigos prie kameros.
                </Text>

                <Pressable style={styles.btn} onPress={requestPermission}>
                    <Text style={styles.btnText}>Suteikti leidimą</Text>
                </Pressable>

                <Pressable style={[styles.btn, { marginTop: 10 }]} onPress={() => navigation.goBack()}>
                    <Text style={styles.btnText}>Atgal</Text>
                </Pressable>
            </AnimatedScreen>
        );
    }

    return (
        <AnimatedScreen style={styles.screen}>
            <Text style={styles.title}>Skenuok QR (check-in)</Text>

            <View style={styles.scannerWrap}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    barcodeScannerSettings={barcodeScannerSettings}
                    onBarcodeScanned={handleBarcodeScanned}
                />
            </View>

            <Text style={styles.hint}>Nukreipk kamerą į trenerio rodomą QR kodą.</Text>

            {processing && (
                <View style={{ paddingTop: 10 }}>
                    <ActivityIndicator color={colors.accent} />
                </View>
            )}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <Pressable style={[styles.btn, { flex: 1 }]} onPress={() => setScanned(false)}>
                    <Text style={styles.btnText}>Skenuoti iš naujo</Text>
                </Pressable>
                <Pressable style={[styles.btn, { flex: 1 }]} onPress={() => navigation.goBack()}>
                    <Text style={styles.btnText}>Uždaryti</Text>
                </Pressable>
            </View>
        </AnimatedScreen>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, padding: 16 },
    title: { color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 12 },
        scannerWrap: {
        height: 420,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
    },
    hint: { color: colors.muted, marginTop: 10 },
    btn: {
        backgroundColor: colors.cardElevated,
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    btnText: { color: colors.text, fontWeight: "800" },
});