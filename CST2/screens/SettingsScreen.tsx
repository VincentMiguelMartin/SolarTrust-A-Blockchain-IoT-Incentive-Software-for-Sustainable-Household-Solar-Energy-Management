import React, { useContext, useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import FloatingBackButton from "../components/FloatingBackButton";
import { AuthContext } from "../context/AuthContext";

type EditMode = "none" | "email" | "password";

export default function SettingsScreen() {

  const { user, updateAccount } = useContext(AuthContext);

  const [mode, setMode] = useState<EditMode>("none");

  const [email, setEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user) {
      setEmail(user.email);
    }
  }, [user]);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>No user logged in</Text>
        <FloatingBackButton />
      </SafeAreaView>
    );
  }

  /* ---------- PASSWORD UPDATE ---------- */
  const handleUpdatePassword = () => {

    if (!oldPassword || !newPassword || !confirmPassword) {
      alert("Please complete all password fields");
      return;
    }

    if (newPassword.length < 4) {
      alert("Password must be at least 4 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("New passwords do not match");
      return;
    }

    const success = updateAccount(email, oldPassword, newPassword);

    if (!success) {
      alert("Incorrect current password");
      return;
    }

    alert("Password updated successfully!");
    setMode("none");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  /* ---------- EMAIL UPDATE ---------- */
  const handleUpdateEmail = () => {
    updateAccount(email, user.password, user.password);
    alert("Email updated!");
    setMode("none");
  };

  return (
    <SafeAreaView style={styles.container}>

      <Text style={styles.title}>Account Settings</Text>

      {/* PROFILE CARD */}
      <View style={styles.card}>

        {/* NAME (DISPLAY ONLY) */}
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user.name}</Text>

        {/* EMAIL */}
        <Text style={[styles.label, { marginTop: 20 }]}>Email</Text>
        <Text style={styles.value}>{user.email}</Text>

        {mode === "none" && (
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => setMode("email")}
          >
            <Text style={styles.smallBtnText}>Change Email</Text>
          </TouchableOpacity>
        )}

        {mode === "email" && (
          <>
            <View style={styles.inputBox}>
              <TextInput
                placeholder="New Email"
                placeholderTextColor="#555"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleUpdateEmail}>
              <Text style={styles.buttonText}>Save Email</Text>
            </TouchableOpacity>
          </>
        )}

        {/* PASSWORD */}
        <Text style={[styles.label, { marginTop: 20 }]}>Password</Text>
        <Text style={styles.value}>••••••••</Text>

        {mode === "none" && (
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => setMode("password")}
          >
            <Text style={styles.smallBtnText}>Change Password</Text>
          </TouchableOpacity>
        )}

        {mode === "password" && (
          <>
            <View style={styles.inputBox}>
              <TextInput
                placeholder="Current Password"
                placeholderTextColor="#555"
                style={styles.input}
                secureTextEntry
                value={oldPassword}
                onChangeText={setOldPassword}
              />
            </View>

            <View style={styles.inputBox}>
              <TextInput
                placeholder="New Password"
                placeholderTextColor="#555"
                style={styles.input}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>

            <View style={styles.inputBox}>
              <TextInput
                placeholder="Confirm New Password"
                placeholderTextColor="#555"
                style={styles.input}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleUpdatePassword}>
              <Text style={styles.buttonText}>Update Password</Text>
            </TouchableOpacity>
          </>
        )}

      </View>

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
    marginBottom: 30
  },

  card: {
    backgroundColor: "#1a1a1a",
    padding: 18,
    borderRadius: 12,
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
    fontWeight: "600",
    marginBottom: 5
  },

  smallBtn: {
    alignSelf: "flex-start",
    marginBottom: 10
  },

  smallBtnText: {
    color: "#FFE100",
    fontWeight: "bold"
  },

  inputBox: {
    backgroundColor: "#d9d9d9",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 55,
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 10,
  },

  input: {
    color: "#000",
    fontSize: 16,
  },

  button: {
    backgroundColor: "#FFE100",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },

  buttonText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },
});
