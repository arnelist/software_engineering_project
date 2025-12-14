import { View, Text, Pressable } from "react-native";

export default function RegisterScreen({ navigation }) {
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <Text>Register (placeholder, will do by UI mockup later)</Text>
            <Pressable onPress={() => navigation.goBack()}>
                <Text style={{ textDecorationLine: "underline" }}>Grįžti</Text>
            </Pressable>
        </View>
    );
}