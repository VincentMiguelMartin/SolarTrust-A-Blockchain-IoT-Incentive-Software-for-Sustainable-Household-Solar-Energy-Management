import React, { useContext, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform
} from "react-native";
import FloatingBackButton from "../components/FloatingBackButton";
import { AuthContext } from "../context/AuthContext";

export default function SettingsScreen() {

  const { user, updateAccount } = useContext(AuthContext);

  const [showEmailEdit, setShowEmailEdit] = useState(false);
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);

  const [email, setEmail] = useState(user?.email || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>No user logged in</Text>
        <FloatingBackButton />
      </SafeAreaView>
    );
  }

  const handleUpdateEmail = () => {
    if (!email || !oldPassword) {
      alert("Enter email and current password");
      return;
    }

    const success = updateAccount(email, oldPassword, user.password);

    if (success) {
      alert("Email updated!");
      setShowEmailEdit(false);
      setOldPassword("");
    } else {
      alert("Incorrect password");
    }
  };

  const handleUpdatePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert("Complete all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const success = updateAccount(user.email, oldPassword, newPassword);

    if (success) {
      alert("Password updated!");
      setShowPasswordEdit(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      alert("Incorrect current password");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >

          <Text style={styles.title}>Account Settings</Text>

          {/* INFO CARD */}
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{user.name}</Text>

            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user.email}</Text>

            <Text style={styles.label}>Password</Text>
            <Text style={styles.value}>••••••••</Text>
          </View>

          {/* BUTTONS */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => {
                setShowEmailEdit(!showEmailEdit);
                setShowPasswordEdit(false);
              }}
            >
              <Text style={styles.smallButtonText}>Change Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => {
                setShowPasswordEdit(!showPasswordEdit);
                setShowEmailEdit(false);
              }}
            >
              <Text style={styles.smallButtonText}>Change Password</Text>
            </TouchableOpacity>
          </View>

          {/* EMAIL EDIT */}
          {showEmailEdit && (
            <View style={styles.editBox}>
              <TextInput
                placeholder="New Email"
                placeholderTextColor="#555"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />

              <TextInput
                placeholder="Current Password"
                placeholderTextColor="#555"
                style={styles.input}
                secureTextEntry
                value={oldPassword}
                onChangeText={setOldPassword}
              />

              <TouchableOpacity style={styles.button} onPress={handleUpdateEmail}>
                <Text style={styles.buttonText}>Update Email</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PASSWORD EDIT */}
          {showPasswordEdit && (
            <View style={styles.editBox}>
              <TextInput
                placeholder="Current Password"
                placeholderTextColor="#555"
                style={styles.input}
                secureTextEntry
                value={oldPassword}
                onChangeText={setOldPassword}
              />

              <TextInput
                placeholder="New Password"
                placeholderTextColor="#555"
                style={styles.input}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <TextInput
                placeholder="Confirm New Password"
                placeholderTextColor="#555"
                style={styles.input}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              <TouchableOpacity style={styles.button} onPress={handleUpdatePassword}>
                <Text style={styles.buttonText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>

        <FloatingBackButton />

      </SafeAreaView>
    </KeyboardAvoidingView>
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
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#333"
  },

  label: {
    color: "#888",
    fontSize: 13,
    marginTop: 12
  },

  value: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 4
  },

  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15
  },

  smallButton: {
    borderWidth: 1,
    borderColor: "#FFE100",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },

  smallButtonText: {
    color: "#FFE100",
    fontWeight: "bold",
    fontSize: 13
  },

  editBox: {
    marginTop: 10
  },

  input: {
    backgroundColor: "#d9d9d9",
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 55,
    marginBottom: 12,
    color: "#000"
  },

  button: {
    backgroundColor: "#FFE100",
    height: 55,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5
  },

  buttonText: {
    color: "#000",
    fontSize: 17,
    fontWeight: "bold"
  }
});
