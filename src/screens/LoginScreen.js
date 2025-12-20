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
import AnimatedScreen from "../components/AnimatedScreen";
import colors from "../theme/colors";

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
            <AnimatedScreen style={styles.container}>
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
            </AnimatedScreen>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
  },
  form: {
    marginTop: 28,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  button: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0b0c10",
  },
  link: {
    marginTop: 10,
    textAlign: "center",
    color: colors.muted,
    fontSize: 13,
  },
  linkStrong: {
    color: colors.accent,
    fontWeight: "700",
  },
});
