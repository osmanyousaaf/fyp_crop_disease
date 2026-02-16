import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

interface User {
    id: string;
    email: string;
    name?: string;
}

interface AuthContextType {
    token: string | null;
    isGuest: boolean;
    user: User | null;
    login: (token: string, user: User) => Promise<void>;
    logout: () => Promise<void>;
    continueAsGuest: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [isGuest, setIsGuest] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadStorage = async () => {
            try {
                const storedToken = await SecureStore.getItemAsync('userToken');
                const storedGuest = await AsyncStorage.getItem('isGuest');
                const storedUser = await AsyncStorage.getItem('userData');

                if (storedToken) {
                    setToken(storedToken);
                    setIsGuest(false);
                    if (storedUser) setUser(JSON.parse(storedUser));
                } else if (storedGuest === 'true') {
                    setIsGuest(true);
                }
            } catch (e) {
                console.error('Failed to load auth state', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadStorage();
    }, []);

    const login = async (newToken: string, userData: User) => {
        setToken(newToken);
        setUser(userData);
        setIsGuest(false);
        await SecureStore.setItemAsync('userToken', newToken);
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        await AsyncStorage.removeItem('isGuest');
    };

    const logout = async () => {
        setToken(null);
        setUser(null);
        setIsGuest(false);
        SecureStore.deleteItemAsync('userToken');
        await AsyncStorage.removeItem('userData');
        await AsyncStorage.removeItem('isGuest');
    };

    const continueAsGuest = () => {
        setIsGuest(true);
        setToken(null);
        setUser(null);
        AsyncStorage.setItem('isGuest', 'true');
        // SecureStore.deleteItemAsync('userToken');
    };

    return (
        <AuthContext.Provider value={{ token, isGuest, user, login, logout, continueAsGuest, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
