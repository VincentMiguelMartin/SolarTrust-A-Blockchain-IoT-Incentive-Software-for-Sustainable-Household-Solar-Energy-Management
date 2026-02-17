import FloatingBackButton from "../components/FloatingBackButton";
import React, { useContext, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { AuthContext } from "../context/AuthContext";

export default function SettingsScreen() {
  const { user } = useContext(AuthContext);
  const [showPassword, setShowPassword] = useState(false);

  // If no user logged in
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>No user logged in</Text>
        <FloatingBackButton />
      </SafeAreaView>
    );
  }

  // SAFELY build masked password
  const maskedPassword = showPassword
      ? user.password
      : "••••••••";

  return (
    <SafeAreaView style={styles.container}>

      <Text style={styles.title}>Account Settings</Text>

      {/* NAME */}
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user.name}</Text>
      </View>

      {/* EMAIL */}
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user.email}</Text>
      </View>

      {/* PASSWORD */}
      <View style={styles.card}>
        <Text style={styles.label}>Password</Text>
        <Text style={styles.value}>{maskedPassword}</Text>

        <TouchableOpacity
          style={styles.showBtn}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Text style={styles.showText}>
            {showPassword ? "Hide Password" : "Show Password"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* FLOATING BACK BUTTON */}
      <FloatingBackButton />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 25,
    paddingTop: 60
  },

  title: {
    color: "#FFE100",
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 35
  },

  card: {
    backgroundColor: "#1a1a1a",
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333"
  },

  label: {
    color: "#888",
    fontSize: 14,
    marginBottom: 6
  },

  value: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600"
  },

  showBtn: {
    marginTop: 12
  },

  showText: {
    color: "#FFE100",
    fontWeight: "bold"
  }
});
