import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";

import FloatingBackButton from "../components/FloatingBackButton";
import { supabase } from "../lib/supabase";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = async () => {
    const { data: userData } = await supabase.auth.getUser();

    const user = userData.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setNotifications(data);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

return (
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === "ios" ? "padding" : "height"}
  >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* CONTENT */}
      <ScrollView
        contentContainerStyle={[
        styles.content,
        { paddingBottom: 120 }
      ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {notifications.length === 0 ? (
          <Text style={styles.placeholder}>
            No notifications yet
          </Text>
        ) : (
          notifications.map((item) => (
            <View
              key={item.id}
              style={styles.notificationCard}
            >
              <Text style={styles.notificationTitle}>
                {item.title}
              </Text>

              <Text style={styles.notificationMessage}>
                {item.message}
              </Text>

              <Text style={styles.notificationDate}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* BACK BUTTON */}
      <FloatingBackButton />

      </SafeAreaView>
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
    paddingHorizontal: 25,
    paddingTop: 60,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 35,
  },

  headerTitle: {
    color: "#32702f",
    fontSize: 28,
    fontWeight: "bold",
  },

  content: {
    paddingBottom: 100,
  },

  placeholder: {
    color: "#000",
    fontSize: 16,
    textAlign: "center",
    marginTop: 50,
  },

  notificationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
  },

  notificationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#32702f",
    marginBottom: 6,
  },

  notificationMessage: {
    fontSize: 14,
    color: "#333333",
    lineHeight: 20,
  },

  notificationDate: {
    fontSize: 12,
    color: "#777777",
    marginTop: 10,
  },
});