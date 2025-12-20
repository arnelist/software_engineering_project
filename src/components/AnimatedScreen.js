import { useCallback, useRef } from "react";
import { Animated } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

export default function AnimatedScreen({ children, style, duration = 260 }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(12)).current;

    useFocusEffect(
        useCallback(() => {
            opacity.setValue(0);
            translateY.setValue(12);

            const animation = Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration,
                    useNativeDriver: true,
                }),
            ]);

            animation.start();
            return () => animation.stop();
        }, [duration, opacity, translateY])
    );

    return (
        <Animated.View style={[{ flex: 1, opacity, transform: [{ translateY }] }, style]}>
            {children}
        </Animated.View>
    );
}
