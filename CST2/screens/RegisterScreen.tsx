import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

export default function RegisterScreen() {
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRegister = async () => {

    if (!name || !email || !password || !confirm) {
      alert("Please fill up all fields");
      return;
    }

    if (password !== confirm) {
      alert("Passwords do not match");
      return;
    }

    // 🔥 CREATE AUTH ACCOUNT (with name in metadata)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: {
          name: name.trim(),   // ✅ SAVE NAME HERE
        },
      },
    });

    if (error) {
      alert(error.message);
      return;
    }

    // 🔥 CREATE PROFILE RECORD (optional but recommended)
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert([
          {
            id: data.user.id,
            full_name: name.trim(),
            email: email.trim(),
          },
        ]);

      if (profileError) {
        console.log("Profile insert error:", profileError.message);
      }
    }

    alert("Account successfully created!");
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Create account</Text>

      {/* NAME */}
      <View style={styles.inputBox}>
        <MaterialIcons name="person" size={24} color="black" />
        <TextInput
          placeholder="Name"
          placeholderTextColor="#555"
          style={styles.input}
          value={name}
          onChangeText={setName}
        />
      </View>

      {/* EMAIL */}
      <View style={styles.inputBox}>
        <MaterialIcons name="email" size={24} color="black" />
        <TextInput
          placeholder="Email"
          placeholderTextColor="#555"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* PASSWORD */}
      <View style={styles.inputBox}>
        <MaterialIcons name="lock" size={24} color="black" />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#555"
          secureTextEntry={!showPassword}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <MaterialIcons
            name={showPassword ? "visibility-off" : "visibility"}
            size={22}
            color="black"
          />
        </TouchableOpacity>
      </View>

      {/* CONFIRM PASSWORD */}
      <View style={styles.inputBox}>
        <MaterialIcons name="lock" size={24} color="black" />
        <TextInput
          placeholder="Confirm password"
          placeholderTextColor="#555"
          secureTextEntry={!showConfirm}
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
        />
        <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
          <MaterialIcons
            name={showConfirm ? "visibility-off" : "visibility"}
            size={22}
            color="black"
          />
        </TouchableOpacity>
      </View>

      {/* REGISTER BUTTON */}
      <TouchableOpacity style={styles.registerBtn} onPress={handleRegister}>
        <Text style={styles.registerText}>Register</Text>
      </TouchableOpacity>

      {/* BACK TO LOGIN */}
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>BACK TO LOGIN</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
    paddingHorizontal: 25,
    paddingTop: 60
  },

  title: {
    color: "#32702f",
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 30
  },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d9d9d9",
    borderRadius: 6,
    paddingHorizontal: 14,
    height: 55,
    marginBottom: 15
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#000"
  },

  registerBtn: {
    backgroundColor: "#32702f",
    height: 55,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15
  },

  registerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFF"
  },

  back: {
    color: "#32702f",
    textAlign: "center",
    marginTop: 25,
    fontWeight: "bold",
    letterSpacing: 1
  }
});