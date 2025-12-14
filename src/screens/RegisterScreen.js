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
        <View style={styles.container}>
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
                <Text style={styles.link}>Jau turi paskyrą? Prisijungti</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  link: {
    marginTop: 14,
    textAlign: "center",
    color: "#374151",
  },
});