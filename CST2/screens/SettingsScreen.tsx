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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config";

function getPlantStorageKey(userId?: string) {
  return `userPlantId:${userId ?? "guest"}`;
}

export default function SettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [plantId, setPlantId] = useState<string>("");

  const [showEmailEdit, setShowEmailEdit] = useState(false);
  const [showPasswordEdit, setShowPasswordEdit] = useState(false);

  const [email, setEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
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

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("plant_id")
        .eq("id", userData.user.id)
        .maybeSingle();

      const storedPlantId = await AsyncStorage.getItem(
        getPlantStorageKey(userData.user.id)
      );

      setPlantId(String(profile?.plant_id ?? storedPlantId ?? "").trim());
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

  // 🔥 Update Email (Force-updates via backend admin API; bypasses confirmation flow)
  const handleUpdateEmail = async () => {
    if (!email) {
      alert("Enter a valid email");
      return;
    }

    if (!emailCurrentPassword) {
      alert("Enter your current password to change email");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      alert("Session expired. Please sign in again.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/update-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          newEmail: email,
          currentPassword: emailCurrentPassword,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(body?.error || "Unable to update email");
        return;
      }

      // Refresh local session so the new email is reflected.
      await supabase.auth.refreshSession();
      const { data: refreshed } = await supabase.auth.getUser();
      if (refreshed.user) setUser(refreshed.user);

      alert("Email updated successfully!");
      setShowEmailEdit(false);
      setEmailCurrentPassword("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to update email");
    }
  };

  // 🔥 Update Password (Force-updates via backend admin API)
  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert("Complete all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      alert("Session expired. Please sign in again.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/update-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: oldPassword,
          newPassword: newPassword,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(body?.error || "Unable to update password");
        return;
      }

      alert("Password updated successfully!");
      setShowPasswordEdit(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Unable to update password");
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

            <Text style={styles.label}>Plant ID</Text>
            <Text style={styles.value}>
              {plantId || "No Plant ID"}
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

              <TextInput
                placeholder="Current Password"
                placeholderTextColor="#555"
                style={styles.input}
                secureTextEntry
                value={emailCurrentPassword}
                onChangeText={setEmailCurrentPassword}
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
    backgroundColor: "#32702f",
    height: 55,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold"
  }
});