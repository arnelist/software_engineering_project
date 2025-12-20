import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import AnimatedScreen from "../components/AnimatedScreen";
import colors from "../theme/colors";

export default function RegisterScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const onRegister = async () => {
        const e = email.trim().toLowerCase();
        if (!e || !password) {
            Alert.alert("Klaida", "Įvesk el. paštą ir slaptažodį.");
            return;
        }

        try {
            setLoading(true);

            const cred = await createUserWithEmailAndPassword(auth, e, password);

            await setDoc(doc(db, 'users', cred.user.uid), {
                email: e,
                role: "client",
                createdAt: serverTimestamp(),
            });

            navigation.replace("Home");
        }   catch (err) {
            console.log(err.code);
            Alert.alert("Registracija nepavyko", err.message);
        }   finally {
            setLoading(false);
        }
    };

    return (
        <AnimatedScreen style={styles.container}>
            <Text style={styles.title}>Registracija</Text>

            <TextInput
                style={styles.input}
                placeholder="El. paštas"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
            />
            <TextInput
                style={styles.input}
                placeholder="Slaptažodis"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />

            <Pressable 
                style={styles.button}
                onPress={onRegister}
                disabled={loading}
            >
                <Text style={styles.buttonText}>
                    {loading ? "Kuriama..." : "Registruokis"}
                </Text>
            </Pressable>

            <Pressable onPress={() => navigation.goBack()}>
                <Text style={styles.link}>
                  Jau turi paskyrą? <Text style={styles.linkStrong}>Prisijungti</Text>
              </Text>
            </Pressable>
        </AnimatedScreen>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center",
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    color: colors.text,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  buttonText: {
    color: "#0b0c10",
    fontWeight: "800",
  },
  link: {
    marginTop: 14,
    textAlign: "center",
    color: colors.muted,
  },
  linkStrong: {
    color: colors.accent,
    fontWeight: "700",
  },
});
