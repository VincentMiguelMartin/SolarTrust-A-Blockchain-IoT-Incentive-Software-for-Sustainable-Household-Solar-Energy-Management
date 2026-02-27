import React, { useEffect, useState } from "react";
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
import { supabase } from "../lib/supabase";

export default function SettingsScreen() {
  const [user, setUser] = useState<any>(null);

  const [showEmailEdit, setShowEmailEdit] = useState(false);
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);

  const [email, setEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 🔥 Get Logged In User
useEffect(() => {
  const checkSession = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    console.log("SESSION:", sessionData.session);

    const { data: userData } = await supabase.auth.getUser();
    console.log("USER:", userData.user);

    if (userData.user) {
      setUser(userData.user);
      setEmail(userData.user.email ?? "");
    }
  };

  checkSession();
}, []);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>No user logged in</Text>
        <FloatingBackButton />
      </SafeAreaView>
    );
  }

  // 🔥 Update Email
  const handleUpdateEmail = async () => {
    if (!email) {
      alert("Enter a valid email");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      email: email,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Email update request sent. Check your email to confirm.");
      setShowEmailEdit(false);
    }
  };

  // 🔥 Update Password (With Current Password Verification)
  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert("Complete all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    // Step 1: Verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: oldPassword,
    });

    if (signInError) {
      alert("Incorrect current password");
      return;
    }

    // Step 2: Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      alert(updateError.message);
    } else {
      alert("Password updated successfully!");
      setShowPasswordEdit(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
            <Text style={styles.value}>
              {user.user_metadata?.name || "No name set"}
            </Text>

            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>
              {user.email}
            </Text>
          </View>

          {/* ACTION BUTTONS */}
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

              <TouchableOpacity
                style={styles.button}
                onPress={handleUpdateEmail}
              >
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

              <TouchableOpacity
                style={styles.button}
                onPress={handleUpdatePassword}
              >
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
    backgroundColor: "#ebeaea",
    padding: 25,
    paddingTop: 60
  },

  title: {
    color: "#32702f",
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
    borderColor: "#32702f",
    backgroundColor: "#32702f",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },

  smallButtonText: {
    color: "#FFFFFF",
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