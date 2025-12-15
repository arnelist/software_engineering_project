import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator } from "react-native";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import BookingScreen from "../screens/BookingScreen";
import ReservationsScreen from "../screens/ReservationsScreen";
import TrainerReservationsScreen from "../screens/TrainerReservationsScreen";

const Stack = createNativeStackNavigator();

function Loading() {
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        </View>
  );
}

function AuthStack() {
  return (
        <Stack.Navigator>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
  );
}

function ClientStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Booking" component={BookingScreen} />
            <Stack.Screen name="Reservations" component={ReservationsScreen} />
        </Stack.Navigator>
    );
}

function TrainerStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen 
                name="TrainerHome"
                component={TrainerReservationsScreen}
                options={{ title: "Rezervacijos" }}
            />
        </Stack.Navigator>
    );
}

export default function RootNavigator() {
    const [booting, setBooting] = useState(true);
    const [authUser, setAuthUser] = useState(null);
    const [role, setRole] = useState(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setAuthUser(u);

            if(!u) {
                setRole(null);
                setBooting(false);
                return;
            }

            try {
                setBooting(true);

                const ref = doc(db, 'users', u.uid);
                const snap = await getDoc(ref);

                if (!snap.exists()) {
                    await setDoc(ref, {
                        email: u.email ?? "",
                        role: "client",
                        createdAt: serverTimestamp(),
                    });
                    setRole("client");
                } else {
                    setRole(snap.data()?.role ?? "client");
                }

                console.log("ROOT UID: ", u.uid, "ROLE: ", snap.data()?.role);
            }   catch (e) {
                    console.log("ROOT LOAD ROLE ERROR:", e);
                    setRole("client");
                }   finally {
                    setBooting(false);
                }
            });

            return () => unsub();
    }, []);

    return (
        <NavigationContainer>
            {booting ? (
                <Loading />
            ) : !authUser ? (
                <AuthStack />
            ) : role === "trainer" ? (
                <TrainerStack />
            ) : (
                <ClientStack />
            )}
        </NavigationContainer>
    );
}