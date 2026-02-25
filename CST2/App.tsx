import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import GameScreen from "./screens/GameScreen";
import RewardScreen from "./screens/RewardScreen";
import StoreScreen from "./screens/StoreScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import DashboardScreen from "./screens/DashboardScreen";
import MenuScreen from "./screens/MenuScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ReportsScreen from "./screens/ReportsScreen";
import AboutScreen from "./screens/AboutScreen";
import WalletScreen from "./screens/WalletScreen";
import StatisticsScreen from "./screens/StatisticsScreen";
import { AuthProvider } from "./context/AuthContext";
import { useEffect } from "react";


export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  Menu: undefined;
  Settings: undefined;
  Reports: undefined;
  About: undefined;
  Store: undefined;
  Notifications: undefined;
  Wallet: undefined;
  Statistics: undefined;
  Game: undefined;
  Reward: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {

  useEffect(() => {
    console.log("[App] Attempting to connect to server...");
    fetch('http://192.168.1.39:3000/test')
      .then(res => {
        console.log("[App] ✓ Response received from server, status:", res.status);
        return res.json();
      })
      .then(data => {
        console.log("[App] ✓ Server connected successfully!", data);
        console.log("[App] Server message:", data.message);
        console.log("[App] Connection timestamp:", data.timestamp);
      })
      .catch(error => {
        console.error("[App] ✗ Connection FAILED:", error.message);
        console.error("[App] Make sure:");
        console.error("  - Server is running on 192.168.1.39:3000");
        console.error("  - Firewall allows port 3000");
        console.error("  - IP address is correct");
      });
  }, []);

  return (
    <NavigationContainer>
      <AuthProvider>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Reward" component={RewardScreen} />
          <Stack.Screen name="Menu" component={MenuScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
          <Stack.Screen name="Store" component={StoreScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Wallet" component={WalletScreen} />
          <Stack.Screen name="Statistics" component={StatisticsScreen} />
        </Stack.Navigator>
      </AuthProvider>
    </NavigationContainer>
  );
}