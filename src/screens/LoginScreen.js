import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const onLogin = async () => {
        const e = email.trim();
        if (!e || !password) {
            Alert.alert("Klaida", "Įvesk el. paštą ir slaptažodį.");
            return;
        }

        try {
            setLoading(true);
            await signInWithEmailAndPassword(auth, e, password);
        } catch (err) {
            const msg = 
                err?.code === "auth/invalid-credential" ||
                err?.code === "auth/wrong-password" ||
                err?.code === "auth/user-not-found"
                    ? "Neteisingas el. paštas arba slaptažodis."
                    : "Nepavyko prisijungti. Bandyk dar kartą.";
            Alert.alert("Prisijungimas nepavyko", msg);
        }   finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === 'ios' ? "padding" : undefined}
        >
            <View style={styles.container}>
                <Text style={styles.title}>CoachBooking</Text>
                <Text style={styles.subtitle}>Rezervuokis trenerį be vargo</Text>

                <View style={styles.form}>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="El. paštas"
                        placeholderTextColor="#9ca3af"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                    />
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Slaptažodis"
                        placeholderTextColor="#9ca3af"
                        secureTextEntry
                        style={styles.input}
                    />
                    
                    <Pressable
                        onPress={onLogin}
                        disabled={loading}
                        style={({ pressed }) => [
                            styles.button,
                            (pressed || loading) && styles.buttonPressed,
                        ]}
                    >
                        <Text style={styles.buttonText}>
                            {loading ? "Jungiama..." : "Prisijungti"}
                        </Text>
                    </Pressable>

                    <Pressable onPress={() => 
                        navigation.navigate("Register")
                    }>
                        <Text style={styles.link}>
                            Neturite paskyros? <Text style={styles.linkStrong}>Registruotis</Text>
                        </Text>
                    </Pressable>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  form: {
    marginTop: 28,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  button: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  link: {
    marginTop: 10,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
  },
  linkStrong: {
    color: "#111827",
    fontWeight: "600",
  },
});