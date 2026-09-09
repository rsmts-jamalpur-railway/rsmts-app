import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated } from 'react-native';

interface SplashProps {
    onFinish: (role: string | null) => void;
}

export default function Splash({ onFinish }: SplashProps) {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const createBounceAnimation = (dot: Animated.Value) => {
            return Animated.sequence([
                Animated.timing(dot, { toValue: -15, duration: 300, useNativeDriver: true }),
                Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]);
        };

        Animated.loop(
            Animated.stagger(150, [
                createBounceAnimation(dot1),
                createBounceAnimation(dot2),
                createBounceAnimation(dot3),
            ])
        ).start();

    }, [dot1, dot2, dot3, onFinish]);

    return (
        <View style={styles.container}>
            <View style={styles.logoContainer}>
                <Image 
                    source={require('../assets/logo_bg_removed.png')} 
                    style={styles.logo}
                    resizeMode="contain"
                />
            </View>
            <View style={styles.dotsContainer}>
                <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
                <Animated.View style={[styles.dot, { transform: [{ translateY: dot2 }] }]} />
                <Animated.View style={[styles.dot, { transform: [{ translateY: dot3 }] }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    logoContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: 220,
        height: 220,
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 60,
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#0F172A',
        marginHorizontal: 8,
    },
});